"""Keep the optional free hosting template explicit and bounded."""
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def test_render_uses_only_a_free_docker_web_service():
    config = yaml.safe_load((ROOT / "render.yaml").read_text())
    assert set(config) == {"services"}
    assert len(config["services"]) == 1
    service = config["services"][0]
    assert service["type"] == "web"
    assert service["runtime"] == "docker"
    assert service["plan"] == "free"
    assert service["healthCheckPath"] == "/api/health"
    assert service["autoDeployTrigger"] == "off"
    assert service["dockerfilePath"] == "./Dockerfile"
    assert "disk" not in service


def test_pages_is_static_and_preserves_multi_page_routing():
    config = json.loads((ROOT / "wrangler.jsonc").read_text())
    assert config["pages_build_output_dir"] == "./frontend/dist"
    assert not any(key in config for key in ("r2_buckets", "kv_namespaces", "durable_objects"))
    assert (ROOT / "frontend/public/404.html").is_file()
    assert not (ROOT / "functions").exists()


def test_hosted_builds_require_explicit_modes():
    package = json.loads((ROOT / "frontend/package.json").read_text())
    assert "--mode pages" in package["scripts"]["build:pages"]
    assert "--mode vercel" in package["scripts"]["build:vercel"]
