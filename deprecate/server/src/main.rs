use axum::{
    routing::{get, post},
    response::{Html, IntoResponse, Response},
    http::StatusCode,
    Json, Router,
};
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use askama::Template; 

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate<'a> {
    title: &'a str,
}

#[tokio::main]
async fn main() {
    // initialize tracing
    tracing_subscriber::fmt::init();

    // run
    // let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    // axum::serve(listener, app).await.unwrap();

    // run
    tokio::join!(
        serve(using_serve_dir(), 8080),
        serve(using_serve_template(), 3000),
    );
}


fn using_serve_dir() -> Router {
    Router::new()
        .nest_service("/", ServeDir::new("static"))
}

fn using_serve_template() -> Router {
    Router::new().route("/", get(root))
}

async fn serve(app: Router, port: u16) {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::debug!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app.layer(TraceLayer::new_for_http()))
        .await
        .unwrap();
}


async fn root() -> impl IntoResponse {
    HtmlTemplate(IndexTemplate {title: "hello world"})
}

struct HtmlTemplate<T>(T);

impl<T> IntoResponse for HtmlTemplate<T>
where
    T: Template,
{
    fn into_response(self) -> Response {
        // Attempt to render the template with askama
        match self.0.render() {
            // If we're able to successfully parse and aggregate the template, serve it
            Ok(html) => Html(html).into_response(),
            // If we're not, return an error or some bit of fallback HTML
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to render template. Error: {}", err),
            )
            .into_response(),
        }
    }
}