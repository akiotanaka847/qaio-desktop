use std::ffi::OsString;

/// Build `agy --print <prompt> --dangerously-skip-permissions` args.
///
/// Antigravity CLI's `--print` mode runs a single prompt non-interactively
/// and prints the response to stdout. `--conversation` resumes by ID.
pub(crate) fn build_args(
    prompt: &str,
    resume_conversation_id: Option<&str>,
    log_file: Option<&std::path::Path>,
) -> Vec<OsString> {
    let mut args = vec![
        OsString::from("--print"),
        OsString::from(prompt),
        OsString::from("--dangerously-skip-permissions"),
    ];

    if let Some(id) = resume_conversation_id {
        args.push(OsString::from("--conversation"));
        args.push(OsString::from(id));
    }

    if let Some(path) = log_file {
        args.push(OsString::from("--log-file"));
        args.push(OsString::from(path));
    }

    args
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(args: Vec<OsString>) -> Vec<String> {
        args.into_iter()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect()
    }

    #[test]
    fn fresh_args_include_prompt_and_skip_permissions() {
        let args = strings(build_args("hello", None, None));
        assert_eq!(args[0], "--print");
        assert_eq!(args[1], "hello");
        assert!(args.contains(&"--dangerously-skip-permissions".to_string()));
        assert!(!args.contains(&"--conversation".to_string()));
    }

    #[test]
    fn resume_args_include_conversation_id() {
        let args = strings(build_args("hello", Some("abc-123"), None));
        assert!(args.contains(&"--conversation".to_string()));
        assert!(args.contains(&"abc-123".to_string()));
    }

    #[test]
    fn log_file_arg() {
        let path = std::path::Path::new("/tmp/agy.log");
        let args = strings(build_args("test", None, Some(path)));
        assert!(args.contains(&"--log-file".to_string()));
        assert!(args.contains(&"/tmp/agy.log".to_string()));
    }

    #[test]
    fn all_options_together() {
        let path = std::path::Path::new("/tmp/agy.log");
        let args = strings(build_args("prompt", Some("conv-id"), Some(path)));
        assert!(args.contains(&"--print".to_string()));
        assert!(args.contains(&"--dangerously-skip-permissions".to_string()));
        assert!(args.contains(&"--conversation".to_string()));
        assert!(args.contains(&"--log-file".to_string()));
    }
}
