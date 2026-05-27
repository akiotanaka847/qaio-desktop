use std::path::PathBuf;

/// Well-known Git for Windows install locations. Checked in order:
/// 64-bit Program Files (most common), 32-bit, then user-profile
/// installs (GitHub Desktop / Scoop).
#[cfg(windows)]
const GIT_FOR_WINDOWS_ROOTS: &[&str] = &[
    "C:\\Program Files\\Git",
    "C:\\Program Files (x86)\\Git",
];

/// Detect a usable shell on Windows for CLI tools that need one (Codex
/// `exec_command`, Gemini sandboxed eval, etc.).
///
/// Resolution order:
/// 1. Existing `SHELL` env var (user or WSL already configured one)
/// 2. Git for Windows `bash.exe` from well-known install locations
/// 3. `cmd.exe` via `COMSPEC` (last resort)
///
/// On non-Windows returns `None` — Unix processes inherit a valid shell.
#[cfg(windows)]
pub fn detect() -> Option<PathBuf> {
    // 1. SHELL env var already set (WSL, MSYS2, user config)
    if let Some(shell) = std::env::var_os("SHELL") {
        let p = PathBuf::from(&shell);
        if p.is_file() {
            tracing::debug!("[windows_shell] using SHELL env: {}", p.display());
            return Some(p);
        }
    }

    // 2. Git for Windows bash.exe
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let user_git = home.join("AppData\\Local\\Programs\\Git");
    let roots: Vec<PathBuf> = GIT_FOR_WINDOWS_ROOTS
        .iter()
        .map(PathBuf::from)
        .chain(std::iter::once(user_git))
        .collect();

    for git_root in &roots {
        let bash = git_root.join("bin").join("bash.exe");
        if bash.is_file() {
            tracing::debug!("[windows_shell] found Git bash: {}", bash.display());
            return Some(bash);
        }
    }

    // 3. COMSPEC (usually C:\WINDOWS\system32\cmd.exe)
    if let Some(comspec) = std::env::var_os("COMSPEC") {
        let p = PathBuf::from(&comspec);
        if p.is_file() {
            tracing::debug!("[windows_shell] fallback to COMSPEC: {}", p.display());
            return Some(p);
        }
    }

    tracing::warn!("[windows_shell] no usable shell found on Windows");
    None
}

/// Returns Git for Windows `bin` and `usr\bin` directories that exist
/// on this machine. These contain Unix utilities (`sh`, `bash`, `cat`,
/// `grep`, etc.) needed by Codex CLI's `exec_command`.
#[cfg(windows)]
pub fn git_bin_dirs() -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"));
    let user_git = home.join("AppData\\Local\\Programs\\Git");
    let roots: Vec<PathBuf> = GIT_FOR_WINDOWS_ROOTS
        .iter()
        .map(PathBuf::from)
        .chain(std::iter::once(user_git))
        .collect();

    let mut dirs = Vec::new();
    for git_root in &roots {
        let bin = git_root.join("bin");
        let usr_bin = git_root.join("usr").join("bin");
        if bin.is_dir() {
            dirs.push(bin);
        }
        if usr_bin.is_dir() {
            dirs.push(usr_bin);
        }
    }
    dirs
}

#[cfg(not(windows))]
pub fn detect() -> Option<PathBuf> {
    None
}

#[cfg(not(windows))]
pub fn git_bin_dirs() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_returns_none_on_unix() {
        if cfg!(not(windows)) {
            assert!(detect().is_none());
        }
    }

    #[test]
    fn git_bin_dirs_empty_on_unix() {
        if cfg!(not(windows)) {
            assert!(git_bin_dirs().is_empty());
        }
    }

    #[test]
    fn detect_does_not_panic() {
        // Must not panic regardless of platform or env state.
        let _ = detect();
    }

    #[test]
    fn git_bin_dirs_does_not_panic() {
        let _ = git_bin_dirs();
    }
}
