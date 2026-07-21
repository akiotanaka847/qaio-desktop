//! Parser for `codex login --device-auth` output.
//!
//! Device-code sign-in is how a user authenticates OpenAI when the engine
//! cannot open a browser for them: a headless server, a container, or a
//! remote engine the desktop app talks to over the network. The CLI prints
//! a verification URL and a short one-time code; the user opens the URL on
//! any device and types the code.
//!
//! The CLI writes that block to stdout as human-readable, ANSI-coloured
//! text, so we scrape it rather than parse a machine format. Observed shape
//! (codex 0.121.0, colour codes stripped here for clarity):
//!
//! ```text
//! Follow these steps to sign in with ChatGPT using device code authorization:
//!
//! 1. Open this link in your browser and sign in to your account
//!    https://auth.openai.com/codex/device
//!
//! 2. Enter this one-time code (expires in 15 minutes)
//!    I6KB-NZ7T6
//! ```

use regex::Regex;
use std::sync::LazyLock;

/// Matches an `https://` URL, stopping before ANSI escapes and whitespace.
static URL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"https://[^\s\x1b]+").expect("valid regex"));

/// Matches the one-time code: groups of 4+ uppercase alphanumerics joined by
/// a hyphen (e.g. `I6KB-NZ7T6`). Anchored to a whole line so it cannot match
/// a fragment of the surrounding prose.
static CODE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^\s*([A-Z0-9]{4,}-[A-Z0-9]{4,})\s*$").expect("valid regex")
});

/// A device-code challenge the user must complete in a browser.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceCode {
    /// Verification URL the user opens.
    pub url: String,
    /// One-time code the user types at that URL.
    pub code: String,
}

/// Strip ANSI SGR escape sequences so the text regexes see plain characters.
fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(c) = chars.next() {
        if c != '\x1b' {
            out.push(c);
            continue;
        }
        // Consume "[ ... <final byte>" of the escape sequence.
        if chars.next() != Some('[') {
            continue;
        }
        for e in chars.by_ref() {
            if e.is_ascii_alphabetic() {
                break;
            }
        }
    }
    out
}

/// Extract the verification URL and one-time code from accumulated CLI
/// output. Returns `None` until both have appeared, so a caller can feed
/// partial output as it streams and act on the first complete result.
pub fn parse(output: &str) -> Option<DeviceCode> {
    let plain = strip_ansi(output);
    let url = URL_RE.find(&plain)?.as_str().to_string();
    let code = CODE_RE.captures(&plain)?.get(1)?.as_str().to_string();
    Some(DeviceCode { url, code })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verbatim capture from `codex login --device-auth` (v0.121.0),
    /// including the ANSI colour codes the CLI emits.
    const REAL_OUTPUT: &str = concat!(
        "\n\x1b[1mWelcome to Codex\x1b[0m [v\x1b[90m0.121.0\x1b[0m]\n",
        "\x1b[90mOpenAI's command-line coding agent\x1b[0m\n\n",
        "Follow these steps to sign in with ChatGPT using device code authorization:\n\n",
        "1. Open this link in your browser and sign in to your account\n",
        "   \x1b[94mhttps://auth.openai.com/codex/device\x1b[0m\n\n",
        "2. Enter this one-time code \x1b[90m(expires in 15 minutes)\x1b[0m\n",
        "   \x1b[94mI6KB-NZ7T6\x1b[0m\n\n",
        "\x1b[90mDevice codes are a common phishing target. Never share this code.\x1b[0m\n",
    );

    #[test]
    fn parses_real_cli_output() {
        let parsed = parse(REAL_OUTPUT).expect("should parse");
        assert_eq!(parsed.url, "https://auth.openai.com/codex/device");
        assert_eq!(parsed.code, "I6KB-NZ7T6");
    }

    #[test]
    fn parses_output_without_ansi_colour() {
        let plain = "1. Open this link\n   https://auth.openai.com/codex/device\n\n\
                     2. Enter this one-time code\n   ABCD-1234X\n";
        let parsed = parse(plain).expect("should parse");
        assert_eq!(parsed.url, "https://auth.openai.com/codex/device");
        assert_eq!(parsed.code, "ABCD-1234X");
    }

    #[test]
    fn returns_none_until_the_code_arrives() {
        // The URL prints first; the code follows a moment later. A caller
        // streaming output must not act on a half-complete challenge.
        let partial = "1. Open this link\n   https://auth.openai.com/codex/device\n";
        assert_eq!(parse(partial), None);
    }

    #[test]
    fn returns_none_for_unrelated_output() {
        assert_eq!(parse("Already logged in as user@example.com"), None);
        assert_eq!(parse(""), None);
    }

    #[test]
    fn does_not_mistake_prose_for_a_code() {
        // Hyphenated uppercase words inside a sentence must not match: the
        // code regex requires the token to own its line.
        let prose = "https://auth.openai.com/codex/device\nUse the ONE-TIME code below\n";
        assert_eq!(parse(prose), None);
    }

    #[test]
    fn strips_ansi_sequences() {
        assert_eq!(strip_ansi("\x1b[94mhello\x1b[0m"), "hello");
        assert_eq!(strip_ansi("plain"), "plain");
    }
}
