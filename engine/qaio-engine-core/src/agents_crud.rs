//! Workspace-scoped agent CRUD — relocated from
//! `app/src-tauri/src/commands/agents.rs`.
//!
//! Each agent lives at `<workspaces_root>/<workspace_name>/<agent_name>/`
//! with metadata in `.qaio/agent.json`. Linked (external) projects use
//! a symlink whose target is the real path on disk.
//!
//! Transport-neutral: REST routes, CLI tools, and the Tauri adapter all
//! consume this module.

use crate::error::{CoreError, CoreResult};
use crate::paths::expand_tilde;
use crate::workspaces;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentMeta {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub config_id: String,
    pub color: Option<String>,
    pub created_at: String,
    pub last_opened_at: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub folder_path: String,
    pub config_id: String,
    pub color: Option<String>,
    pub created_at: String,
    pub last_opened_at: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgent {
    pub name: String,
    pub config_id: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub claude_md: Option<String>,
    #[serde(default)]
    pub installed_path: Option<String>,
    #[serde(default)]
    pub seeds: Option<HashMap<String, String>>,
    #[serde(default)]
    pub existing_path: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentResult {
    pub agent: Agent,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAgent {
    pub color: String,
}

fn qaio_dir(folder: &Path) -> PathBuf {
    folder.join(".qaio")
}

fn agent_json_path(folder: &Path) -> PathBuf {
    qaio_dir(folder).join("agent.json")
}

fn read_agent_meta(folder: &Path) -> CoreResult<AgentMeta> {
    let path = agent_json_path(folder);
    let contents = fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&contents)?)
}

fn write_agent_meta(folder: &Path, meta: &AgentMeta) -> CoreResult<()> {
    let dir = qaio_dir(folder);
    fs::create_dir_all(&dir)?;
    let target = dir.join("agent.json");
    let tmp = dir.join("agent.json.tmp");
    let json = serde_json::to_string_pretty(meta)?;
    fs::write(&tmp, &json)?;
    fs::rename(&tmp, &target)?;
    Ok(())
}

fn meta_to_agent(folder: &Path, meta: &AgentMeta) -> Agent {
    let name = meta.name.clone().unwrap_or_else(|| {
        folder
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default()
    });
    let real_path = fs::canonicalize(folder).unwrap_or_else(|_| folder.to_path_buf());
    Agent {
        id: meta.id.clone(),
        name,
        folder_path: real_path.to_string_lossy().to_string(),
        config_id: meta.config_id.clone(),
        color: meta.color.clone(),
        created_at: meta.created_at.clone(),
        last_opened_at: meta.last_opened_at.clone(),
    }
}

fn find_agent_by_id(ws_dir: &Path, id: &str) -> CoreResult<PathBuf> {
    let entries = fs::read_dir(ws_dir)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if !agent_json_path(&path).exists() {
            continue;
        }
        if let Ok(meta) = read_agent_meta(&path) {
            if meta.id == id {
                return Ok(path);
            }
        }
    }
    Err(CoreError::NotFound(format!("Agent not found: {id}")))
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

/// Resolve the workspace folder from (root, workspace_id).
fn resolve_ws_folder(root: &Path, workspace_id: &str) -> CoreResult<PathBuf> {
    let workspaces = workspaces::read_all(root)?;
    let ws = workspaces
        .iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| CoreError::NotFound(format!("Workspace not found: {workspace_id}")))?;
    let folder = root.join(&ws.name);
    fs::create_dir_all(&folder)?;
    Ok(folder)
}

fn seed_json_if_missing(qaio: &Path, filename: &str, content: &str) -> CoreResult<()> {
    let path = qaio.join(filename);
    if !path.exists() {
        fs::write(&path, content)?;
    }
    Ok(())
}

fn is_activity_seed_path(path: &str) -> bool {
    matches!(
        path,
        ".qaio/activity.json" | ".qaio/activity/activity.json"
    )
}

/// List agents within a workspace folder.
pub fn list(root: &Path, workspace_id: &str) -> CoreResult<Vec<Agent>> {
    let ws_dir = resolve_ws_folder(root, workspace_id)?;
    let entries = fs::read_dir(&ws_dir)?;
    let mut agents = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_symlink() && !path.exists() {
            tracing::warn!("[agents] removing dangling symlink: {name}");
            let _ = fs::remove_file(&path);
            continue;
        }
        if !path.is_dir() {
            continue;
        }
        if !agent_json_path(&path).exists() {
            continue;
        }
        match read_agent_meta(&path) {
            Ok(meta) => agents.push(meta_to_agent(&path, &meta)),
            Err(e) => tracing::warn!("[agents] skipping {name}: {e}"),
        }
    }

    agents.sort_by(|a, b| {
        let a_time = a.last_opened_at.as_deref().unwrap_or("");
        let b_time = b.last_opened_at.as_deref().unwrap_or("");
        b_time.cmp(a_time)
    });

    Ok(agents)
}

pub fn create(root: &Path, workspace_id: &str, req: CreateAgent) -> CoreResult<CreateAgentResult> {
    let ws_dir = resolve_ws_folder(root, workspace_id)?;

    let is_linked = req.existing_path.is_some();
    let folder = if let Some(ref ep) = req.existing_path {
        let p = expand_tilde(Path::new(ep));
        if !p.exists() {
            return Err(CoreError::BadRequest(format!(
                "Directory does not exist: {}",
                p.display()
            )));
        }
        let link_path = ws_dir.join(&req.name);
        if link_path.exists() {
            return Err(CoreError::Conflict(format!(
                "An agent named \"{}\" already exists",
                req.name
            )));
        }
        #[cfg(unix)]
        std::os::unix::fs::symlink(&p, &link_path)?;
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&p, &link_path)?;
        p
    } else {
        let f = ws_dir.join(&req.name);
        if f.exists() {
            return Err(CoreError::Conflict(format!(
                "An agent named \"{}\" already exists",
                req.name
            )));
        }
        fs::create_dir_all(&f)?;
        f
    };

    fs::create_dir_all(folder.join(".agents/skills"))?;
    if let Some(installed_path) = req.installed_path.as_ref() {
        let packaged_skills = PathBuf::from(installed_path).join(".agents").join("skills");
        if packaged_skills.exists() {
            crate::store::copy_dir_all(&packaged_skills, &folder.join(".agents/skills"))?;
        }
    }

    let now = now_iso();
    let meta = AgentMeta {
        id: Uuid::new_v4().to_string(),
        name: if is_linked {
            Some(req.name.clone())
        } else {
            None
        },
        config_id: req.config_id.clone(),
        color: req.color,
        created_at: now.clone(),
        last_opened_at: Some(now),
    };
    write_agent_meta(&folder, &meta)?;

    let claude_md_path = folder.join("CLAUDE.md");
    if !claude_md_path.exists() {
        let content = req
            .claude_md
            .or_else(|| {
                req.installed_path
                    .as_ref()
                    .and_then(|p| fs::read_to_string(PathBuf::from(p).join("CLAUDE.md")).ok())
            })
            .unwrap_or_else(|| DEFAULT_AGENT_FRAMEWORK.to_string());
        fs::write(&claude_md_path, &content)?;
    }
    for mirror in ["AGENTS.md", "GEMINI.md"] {
        let path = folder.join(mirror);
        if !path.exists() {
            let source = req
                .installed_path
                .as_ref()
                .and_then(|p| fs::read_to_string(PathBuf::from(p).join(mirror)).ok());
            let content = source.unwrap_or_else(|| {
                fs::read_to_string(&claude_md_path).unwrap_or_default()
            });
            fs::write(&path, &content)?;
        }
    }

    let qstrauss_md_path = folder.join("QSTRAUSS.md");
    if !qstrauss_md_path.exists() {
        let source = req
            .installed_path
            .as_ref()
            .and_then(|p| fs::read_to_string(PathBuf::from(p).join("QSTRAUSS.md")).ok());
        if let Some(content) = source {
            fs::write(&qstrauss_md_path, content)?;
        } else if let Some(bundled) = crate::store::bundled::bundled_qstrauss_md() {
            fs::write(&qstrauss_md_path, bundled)?;
        }
    }

    if let Some(seed_files) = req.seeds {
        for (path, content) in &seed_files {
            if is_activity_seed_path(path) {
                continue;
            }
            let target = folder.join(path);
            if !target.exists() {
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::write(&target, content)?;
            }
        }
    }

    crate::agents::prompt::seed_agent(&folder).map_err(CoreError::Internal)?;

    let qaio = qaio_dir(&folder);
    seed_json_if_missing(&qaio, "activity.json", "[]")?;
    seed_json_if_missing(&qaio, "config.json", "{}")?;

    Ok(CreateAgentResult {
        agent: meta_to_agent(&folder, &meta),
    })
}

pub fn delete(root: &Path, workspace_id: &str, id: &str) -> CoreResult<()> {
    let ws_dir = resolve_ws_folder(root, workspace_id)?;
    let folder = find_agent_by_id(&ws_dir, id)?;
    if folder.is_symlink() {
        fs::remove_file(&folder)?;
    } else {
        fs::remove_dir_all(&folder)?;
    }
    Ok(())
}

pub fn rename(root: &Path, workspace_id: &str, id: &str, new_name: &str) -> CoreResult<Agent> {
    let ws_dir = resolve_ws_folder(root, workspace_id)?;
    let old_folder = find_agent_by_id(&ws_dir, id)?;
    let new_link = ws_dir.join(new_name);

    if new_link.exists() {
        return Err(CoreError::Conflict(format!(
            "An agent named \"{new_name}\" already exists"
        )));
    }

    if old_folder.is_symlink() {
        let target = fs::read_link(&old_folder)?;
        fs::remove_file(&old_folder)?;
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, &new_link)?;
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&target, &new_link)?;
        let mut meta = read_agent_meta(&new_link)?;
        meta.name = Some(new_name.to_string());
        write_agent_meta(&new_link, &meta)?;
        Ok(meta_to_agent(&new_link, &meta))
    } else {
        fs::rename(&old_folder, &new_link)?;
        let meta = read_agent_meta(&new_link)?;
        Ok(meta_to_agent(&new_link, &meta))
    }
}

pub fn update(root: &Path, workspace_id: &str, id: &str, req: UpdateAgent) -> CoreResult<Agent> {
    let ws_dir = resolve_ws_folder(root, workspace_id)?;
    let folder = find_agent_by_id(&ws_dir, id)?;
    let color = req.color.trim();
    if color.is_empty() {
        return Err(CoreError::BadRequest("Agent color is required".into()));
    }

    let mut meta = read_agent_meta(&folder)?;
    meta.color = Some(color.to_string());
    write_agent_meta(&folder, &meta)?;
    Ok(meta_to_agent(&folder, &meta))
}

const DEFAULT_AGENT_FRAMEWORK: &str = r#"# Instrucciones del Agente
> Este archivo esta replicado en CLAUDE.md, AGENTS.md y GEMINI.md para que las mismas
> instrucciones carguen en cualquier entorno de IA.

## Aprendizajes del Agente (Mejora Continua)

> **INSTRUCCION CRITICA — LEER PRIMERO:** Esta seccion es tu memoria persistente de
> mejora continua. **Con cada ciclo de ejecucion** (al completar una tarea, resolver un error,
> descubrir un patron, o ajustar un flujo) **debes agregar aqui un aprendizaje nuevo** si
> surgio algo no trivial. El objetivo es que este archivo se vuelva mas util y preciso con el
> tiempo, acumulando conocimiento que no se pierde entre sesiones.
>
> **Que registrar:** restricciones de APIs descubiertas, rate limits reales, patrones que
> funcionan, errores que se repiten, decisiones de diseno tomadas con el usuario, supuestos
> que resultaron falsos, atajos utiles, gotchas del entorno.
>
> **Que NO registrar:** detalles efimeros de una sola tarea, informacion ya documentada en
> el skill correspondiente, cosas triviales derivables del codigo.
>
> **Formato de cada aprendizaje:**
> ```
> - **YYYY-MM-DD — [Tema corto]:** Descripcion en 1-3 lineas. **Por que importa:**
>   consecuencia practica o como aplicarlo en el futuro.
> ```
>
> **Higiene:** si un aprendizaje queda obsoleto o se contradice con otro mas reciente,
> actualizalo o eliminalo en vez de acumular ruido. Mantener la lista ordenada por fecha
> (mas recientes arriba). Si superas ~25 entradas, consolida las mas antiguas o promocianalas
> al skill que corresponda.

### Registro de aprendizajes

<!-- Agrega nuevas entradas arriba de esta linea. -->

---

Tu operas dentro de una arquitectura de 3 capas que separa responsabilidades para maximizar
la confiabilidad. Los LLMs son probabilisticos, mientras que la mayoria de la logica de negocio
es determinista y requiere consistencia. Este sistema resuelve esa incompatibilidad.

## La Arquitectura de 3 Capas

**Capa 1: Skills (Que hacer)**
- SOPs escritos en Markdown, ubicados en `.agents/skills/*/SKILL.md`
- Definen los objetivos, entradas, pasos, salidas y casos extremos
- Instrucciones en lenguaje natural, como las que le daria a un empleado de nivel medio

**Capa 2: Orquestacion (Toma de decisiones)**
- Esta es tu funcion. Tu trabajo: enrutamiento inteligente.
- Leer skills, llamar herramientas en el orden correcto, manejar errores, pedir aclaraciones,
  actualizar skills con los aprendizajes
- Tu eres el puente entre la intencion y la ejecucion
- Cuando un skill indica usar una integracion (Composio), usala en vez de improvisar

**Capa 3: Ejecucion (Hacer el trabajo)**
- Integraciones via **Composio** (Gmail, Calendar, CRM, Slack, etc.) para operaciones con APIs externas
- Operaciones de archivos dentro del directorio del agente para datos persistentes
- El contexto del usuario se almacena en `config/context-ledger.json`
- Confiable, reproducible, rapido. Usa integraciones conectadas en vez de trabajo manual.

**Por que funciona:** si tu haces todo improvisando, los errores se acumulan. Un 90% de
precision por paso = 59% de exito en 5 pasos. La solucion es empujar la complejidad hacia
herramientas deterministas (Composio, archivos estructurados). Asi tu te concentras solo en
la toma de decisiones.

## Principios de Operacion

**1. Revisa primero si existe un skill**
Antes de improvisar, revisa `.agents/skills/` segun lo que el usuario pide. Solo improvisa si
no existe ningun skill relevante.

**2. Auto-correccion cuando algo falla**
- Lee el mensaje de error
- Corrige el enfoque e intenta de nuevo (si usa tokens o creditos de pago, consulta primero)
- Actualiza el skill o este archivo con lo que aprendiste (limites de API, tiempos, casos extremos)

**3. Actualiza los skills a medida que aprendes**
Los skills son documentos vivos. Cuando descubras restricciones, mejores enfoques, errores
comunes o expectativas de tiempo, actualiza el SKILL.md correspondiente. Pero no crees ni
sobreescribas skills sin preguntar, a menos que se te indique explicitamente.

**4. Usa las integraciones conectadas**
Composio conecta tus apps (Gmail, Calendar, CRM, Slack, etc.). Antes de pedir datos al
usuario, verifica si hay una integracion conectada que ya tiene esa informacion. Conexiones
disponibles desde la pestana de Integraciones.

## Ciclo de Auto-correccion

Los errores son oportunidades de aprendizaje. Cuando algo falla:
1. Corrige el problema
2. Actualiza el skill si aplica
3. Prueba que funcione
4. Registra el aprendizaje en este archivo
5. El sistema ahora es mas robusto

## Organizacion de Archivos

- `.agents/skills/*/SKILL.md` — SOPs (conjunto de instrucciones por tarea)
- `config/` — Contexto persistente del usuario (`context-ledger.json`, configuraciones)
- Archivos de salida — En las carpetas que defina cada skill (reportes, borradores, analisis)

**Principio clave:** Cualquier salida debe ser reproducible ejecutando el skill de nuevo, nunca
editada a mano.

## Resumen

Tu estas entre la intencion humana (lo que el usuario pide) y la ejecucion determinista
(skills + Composio). Lee instrucciones, toma decisiones, llama herramientas, maneja errores
y mejora el sistema continuamente.

Se pragmatico. Se confiable. Auto-corrigete.
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspaces::CreateWorkspace;
    use tempfile::TempDir;

    fn setup_ws(root: &Path) -> String {
        workspaces::create(
            root,
            CreateWorkspace {
                name: "alpha".into(),
                provider: None,
                model: None,
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn create_and_list() {
        let d = TempDir::new().unwrap();
        let ws_id = setup_ws(d.path());
        let res = create(
            d.path(),
            &ws_id,
            CreateAgent {
                name: "first".into(),
                config_id: "blank".into(),
                color: None,
                claude_md: None,
                installed_path: None,
                seeds: None,
                existing_path: None,
            },
        )
        .unwrap();
        assert_eq!(res.agent.name, "first");
        assert_eq!(
            fs::read_to_string(d.path().join("alpha/first/.qaio/activity.json")).unwrap(),
            "[]"
        );

        let all = list(d.path(), &ws_id).unwrap();
        assert_eq!(all.len(), 1);
    }

    #[test]
    fn create_ignores_template_activity_seed() {
        let d = TempDir::new().unwrap();
        let ws_id = setup_ws(d.path());
        let mut seeds = HashMap::new();
        seeds.insert(
            ".qaio/activity.json".to_string(),
            r#"[{"id":"seeded","title":"Start anywhere - I'll ask for what I need","description":"No upfront onboarding.","status":"needs_you"}]"#.to_string(),
        );

        create(
            d.path(),
            &ws_id,
            CreateAgent {
                name: "store-agent".into(),
                config_id: "engineering".into(),
                color: None,
                claude_md: None,
                installed_path: None,
                seeds: Some(seeds),
                existing_path: None,
            },
        )
        .unwrap();

        assert_eq!(
            fs::read_to_string(d.path().join("alpha/store-agent/.qaio/activity.json")).unwrap(),
            "[]"
        );
    }

    #[test]
    fn rename_and_delete() {
        let d = TempDir::new().unwrap();
        let ws_id = setup_ws(d.path());
        let res = create(
            d.path(),
            &ws_id,
            CreateAgent {
                name: "n".into(),
                config_id: "gmail".into(),
                color: None,
                claude_md: None,
                installed_path: None,
                seeds: None,
                existing_path: None,
            },
        )
        .unwrap();
        let renamed = rename(d.path(), &ws_id, &res.agent.id, "m").unwrap();
        assert_eq!(renamed.name, "m");
        delete(d.path(), &ws_id, &res.agent.id).unwrap();
        assert!(list(d.path(), &ws_id).unwrap().is_empty());
    }

    #[test]
    fn update_color_persists() {
        let d = TempDir::new().unwrap();
        let ws_id = setup_ws(d.path());
        let res = create(
            d.path(),
            &ws_id,
            CreateAgent {
                name: "n".into(),
                config_id: "gmail".into(),
                color: None,
                claude_md: None,
                installed_path: None,
                seeds: None,
                existing_path: None,
            },
        )
        .unwrap();

        let updated = update(
            d.path(),
            &ws_id,
            &res.agent.id,
            UpdateAgent {
                color: "forest".into(),
            },
        )
        .unwrap();

        assert_eq!(updated.color.as_deref(), Some("forest"));
        let all = list(d.path(), &ws_id).unwrap();
        assert_eq!(all[0].color.as_deref(), Some("forest"));
    }
}
