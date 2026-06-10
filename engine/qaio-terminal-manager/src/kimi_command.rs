use std::ffi::OsString;

/// Build `kimi -p <prompt> --output-format stream-json` args.
///
/// Kimi CLI's `-p` / `--prompt` flag runs a single prompt
/// non-interactively. `--output-format stream-json` gives us NDJSON
/// streaming. `-S <id>` resumes a session by ID.
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
