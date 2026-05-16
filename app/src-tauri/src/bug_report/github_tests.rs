use super::github::create_github_issue;
use super::sample_payload;
use std::io::{Read, Write};
use std::net::TcpListener;

#[tokio::test]
async fn create_github_issue_posts_to_correct_endpoint() {
    let (base_url, server) = serve_once(
        "201 Created",
        r#"{"number":42,"html_url":"https://github.com/akiotanaka847/qaio-desktop/issues/42"}"#,
    );

    create_github_issue(&base_url, "ghp_test-token", "akiotanaka847/qaio-desktop", &sample_payload())
        .await
        .expect("create issue");

    let request = server.join().expect("join test server");
    assert!(request.starts_with("POST /repos/akiotanaka847/qaio-desktop/issues HTTP/1.1"));
    let lower = request.to_ascii_lowercase();
    assert!(lower.contains("authorization: bearer ghp_test-token"));
    assert!(lower.contains("user-agent: qaio-desktop"));
    assert!(request.contains("Qaio bug: list_workspaces - Error: no workspace found"));
    assert!(request.contains("\"labels\":[\"bug\",\"user-report\"]"));
}

#[tokio::test]
async fn create_github_issue_surfaces_api_errors() {
    let (base_url, server) = serve_once(
        "422 Unprocessable Entity",
        r#"{"message":"Validation Failed"}"#,
    );

    let error = create_github_issue(&base_url, "ghp_test-token", "akiotanaka847/qaio-desktop", &sample_payload())
        .await
        .expect_err("API error should fail");

    server.join().expect("join test server");
    assert!(error.contains("422"), "error should contain status: {error}");
    assert!(error.contains("Validation Failed"), "error should contain body: {error}");
}

fn serve_once(
    status: &'static str,
    body: &'static str,
) -> (String, std::thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
    let addr = listener.local_addr().expect("read listener address");
    let server = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept request");
        let request = read_request(&mut stream);
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        );
        stream
            .write_all(response.as_bytes())
            .expect("write response");
        String::from_utf8(request).expect("request is utf8")
    });
    (format!("http://{addr}"), server)
}

fn read_request(stream: &mut std::net::TcpStream) -> Vec<u8> {
    let mut request = Vec::new();
    let mut buffer = [0; 4096];
    loop {
        let read = stream.read(&mut buffer).expect("read request");
        if read == 0 {
            break;
        }
        request.extend_from_slice(&buffer[..read]);
        if let Some(header_end) = find_header_end(&request) {
            let headers = String::from_utf8_lossy(&request[..header_end]);
            let content_length = headers
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim())
                })
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(0);
            if request.len() >= header_end + 4 + content_length {
                break;
            }
        }
    }
    request
}

fn find_header_end(request: &[u8]) -> Option<usize> {
    request.windows(4).position(|window| window == b"\r\n\r\n")
}
