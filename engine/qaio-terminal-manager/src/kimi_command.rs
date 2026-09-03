use std::ffi::OsString;

/// Build `kimi -p <prompt> --output-format stream-json -y` args.
///
/// Kimi CLI's `-p` / `--prompt` flag runs a single prompt
/// non-interactively. `--output-format stream-json` gives us NDJSON
/// streaming. `-S <id>` resumes a session by ID. `-y` approves tool
/// calls, which a headless run has no other way to do.
pub(crate) fn build_args(
    prompt: &str,
    resume_session_id: Option<&str>,
    working_dir: Option<&std::path::Path>,
    model: Option<&str>,
) -> Vec<OsString> {
    let mut args = vec![
        OsString::from("-p"),
        OsString::from(prompt),
        OsString::from("--output-format"),
        OsString::from("stream-json"),
        // Headless `-p` has no TTY, so a tool call that needs approval
        // has nobody to approve it and the turn stalls. Every other
        // provider Qaio spawns already passes its equivalent (claude
        // and agy: --dangerously-skip-permissions, codex:
        // --dangerously-bypass-approvals-and-sandbox); Kimi was the
        // only one left without one. `-y` is the approve-everything
        // flag — `--auto` is a softer permission mode that does not
        // guarantee unattended progress.
        OsString::from("-y"),
    ];

    if let Some(id) = resume_session_id {
        args.push(OsString::from("-S"));
        args.push(OsString::from(id));
    }

    // kimi-code v0.6.0 does not support -w; working dir is set via
    // cmd.current_dir() in the spawn function.
    let _ = working_dir;

    // Kimi model selection requires the model to be registered in
    // ~/.kimi-code/config.toml [models.*]. Only pass -m if provided,
    // otherwise kimi uses default_model from its config.
    if let Some(m) = model {
        args.push(OsString::from("-m"));
        args.push(OsString::from(m));
    }

    args
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(args: Vec<OsString>) -> Vec<String> {
        args.into_iter()
            .map(|a| a.to_string_lossy().to_string())
            .collect()
    }

    #[test]
    fn fresh_args_include_prompt_and_stream_json() {
        let args = strings(build_args("hello", None, None, None));
        assert!(args.contains(&"-p".to_string()));
        assert!(args.contains(&"hello".to_string()));
        assert!(args.contains(&"--output-format".to_string()));
        assert!(args.contains(&"stream-json".to_string()));
    }

    #[test]
    fn always_approves_tool_calls() {
        // Headless `-p` cannot answer an approval prompt, so `-y` is
        // not optional — without it a tool call stalls the turn.
        let args = strings(build_args("hello", None, None, None));
        assert!(args.contains(&"-y".to_string()));
    }

    #[test]
    fn resume_keeps_the_approval_flag() {
        // A resumed turn runs just as headless as a fresh one.
        let args = strings(build_args("hello", Some("session_abc"), None, Some("kimi-k2.6")));
        assert!(args.contains(&"-y".to_string()));
    }

    #[test]
    fn resume_args_include_session_id() {
        let args = strings(build_args("hello", Some("session_abc"), None, None));
        assert!(args.contains(&"-S".to_string()));
        assert!(args.contains(&"session_abc".to_string()));
    }

    #[test]
    fn model_arg() {
        let args = strings(build_args("hello", None, None, Some("moonshot-v1-auto")));
        assert!(args.contains(&"-m".to_string()));
        assert!(args.contains(&"moonshot-v1-auto".to_string()));
    }

    #[test]
    fn no_working_dir_flag() {
        // kimi-code v0.6.0 has no -w flag; working dir set via current_dir().
        let path = std::path::Path::new("/tmp/project");
        let args = strings(build_args("hello", None, Some(path), None));
        assert!(!args.contains(&"-w".to_string()));
    }
}
