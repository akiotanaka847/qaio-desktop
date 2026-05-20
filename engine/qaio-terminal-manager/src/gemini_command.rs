use std::ffi::OsString;

/// Build `gemini -p <prompt> --output-format stream-json --yolo` args.
///
/// The prompt is passed as an argument to `-p` rather than via stdin,
/// because Gemini CLI expects the prompt inline in headless mode.
pub(crate) fn build_args(
    prompt: &str,
    resume_session_id: Option<&str>,
    model: Option<&str>,
) -> Vec<OsString> {
    let mut args = vec![
        OsString::from("-p"),
        OsString::from(prompt),
        OsString::from("--output-format"),
        OsString::from("stream-json"),
        OsString::from("--yolo"),
    ];

    if let Some(m) = model {
        args.push(OsString::from("-m"));
        args.push(OsString::from(m));
    }

    if let Some(session_id) = resume_session_id {
        args.push(OsString::from("--resume"));
        args.push(OsString::from(session_id));
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
    fn fresh_args_include_prompt_and_yolo() {
        let args = strings(build_args("hello", None, None));
        assert_eq!(args[0], "-p");
        assert_eq!(args[1], "hello");
        assert!(args.contains(&"--output-format".to_string()));
        assert!(args.contains(&"stream-json".to_string()));
        assert!(args.contains(&"--yolo".to_string()));
        assert!(!args.contains(&"--resume".to_string()));
    }

    #[test]
    fn resume_args_include_session_id_and_model() {
        let args = strings(build_args(
            "hello",
            Some("session-123"),
            Some("gemini-2.5-flash"),
        ));
        assert!(args.contains(&"--resume".to_string()));
        assert!(args.contains(&"session-123".to_string()));
        assert!(args.contains(&"-m".to_string()));
        assert!(args.contains(&"gemini-2.5-flash".to_string()));
    }

    #[test]
    fn model_flag_without_resume() {
        let args = strings(build_args("test", None, Some("gemini-2.5-pro")));
        assert!(args.contains(&"-m".to_string()));
        assert!(args.contains(&"gemini-2.5-pro".to_string()));
        assert!(!args.contains(&"--resume".to_string()));
    }
}
