#!/usr/bin/env python3
from collections import Counter
from pathlib import Path
import re
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
errors: list[str] = []

for page in root.rglob("*.html"):
    source = page.read_text(encoding="utf-8", errors="ignore")
    dom_only = re.sub(r"<script\b[^>]*>[\s\S]*?</script\s*>", "", source, flags=re.I)
    duplicate_ids = [key for key, count in Counter(re.findall(r"\bid=[\"']([^\"']+)", dom_only)).items() if count > 1]
    if duplicate_ids:
        errors.append(f"{page.relative_to(root)} duplicate ids: {duplicate_ids}")

    for _, url in re.findall(r"\b(src|href)=[\"']([^\"']+)", source):
        if not url.startswith("/") or url.startswith("//"):
            continue
        clean = url.split("?", 1)[0].split("#", 1)[0]
        target = root / clean.lstrip("/")
        if clean.endswith("/"):
            target /= "index.html"
        if not target.exists():
            errors.append(f"{page.relative_to(root)} missing local asset: {url}")

    for index, match in enumerate(re.finditer(r"<script\b([^>]*)>([\s\S]*?)</script\s*>", source, re.I)):
        attrs, code = match.groups()
        if "src=" in attrs.lower() or "application/ld+json" in attrs.lower() or not code.strip():
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as handle:
            handle.write(code)
            handle.flush()
            result = subprocess.run(["node", "--check", handle.name], capture_output=True, text=True)
        if result.returncode:
            errors.append(f"{page.relative_to(root)} inline script {index}: {result.stderr.strip()}")

for script in ["security-core.js", "registration-secure.js", "presence.js", "sw.js", "management/management.js", "attendance/attendance.js"]:
    result = subprocess.run(["node", "--check", str(root / script)], capture_output=True, text=True)
    if result.returncode:
        errors.append(f"{script}: {result.stderr.strip()}")

for file in root.rglob("*"):
    if file.resolve() == Path(__file__).resolve() or not file.is_file() or "__pycache__" in file.parts or file.suffix in {".png", ".jpg", ".gif", ".mp3", ".zip", ".pyc"} or file.name == "DEPLOYMENT.md":
        continue
    text = file.read_text(encoding="utf-8", errors="ignore")
    if "5scdGp3iWsHq45" in text or re.search(r"const\s+SUPABASE_SERVICE_ROLE\s*=", text):
        errors.append(f"possible service-role secret: {file.relative_to(root)}")

required_deployment_files = [
    "SUPABASE-UPDATE.sql",
    "supabase/migrations/202608140001_secure_platform.sql",
    "index.html",
    "CNAME",
    ".nojekyll",
]
for relative in required_deployment_files:
    if not (root / relative).exists():
        errors.append(f"missing deployment file: {relative}")

cname = root / "CNAME"
if cname.exists() and cname.read_text(encoding="utf-8").strip() != "aastcitl.me":
    errors.append("CNAME does not contain aastcitl.me")

migration = (root / "supabase/migrations/202608140001_secure_platform.sql")
if migration.exists():
    migration_text = migration.read_text(encoding="utf-8")
    for marker in [
        "CITL Secure v3 database installation verified successfully",
        "meetings_durable_notifications",
        "drop policy if exists %I on public.%I",
        "citl_secure_api",
        "citl_attendance_scan",
        "citl_prepare_registration",
        "citl_name_list_matches",
        "visiting_sessions_term_schedule_visitor_uq",
        "schedule_instructors",
        "qr_eligible_rooms",
    ]:
        if marker not in migration_text:
            errors.append(f"migration safety marker missing: {marker}")
    shortcut = root / "SUPABASE-UPDATE.sql"
    if shortcut.exists() and shortcut.read_bytes() != migration.read_bytes():
        errors.append("SUPABASE-UPDATE.sql differs from the canonical migration")

for forbidden in ["START-HERE.bat", "DEPLOY-SECURE-V3.ps1", "GITHUB-PAGES-READY"]:
    if (root / forbidden).exists():
        errors.append(f"obsolete installer item still present: {forbidden}")

management_html = (root / "management" / "index.html").read_text(encoding="utf-8")
management_js = (root / "management" / "management.js").read_text(encoding="utf-8")
for marker in ["visitor-name", "qr-summary", "eligible-rooms"]:
    if f'id="{marker}"' not in management_html:
        errors.append(f"management UI marker missing: {marker}")
for marker in ["state.schedule_instructors", "state.qr_eligible_rooms", "QR ثابت لهذه القاعة طوال الترم"]:
    if marker not in management_js:
        errors.append(f"management logic marker missing: {marker}")

sql_text = (root / "SUPABASE-UPDATE.sql").read_text(encoding="utf-8")
if "join public.visiting_lecture_sessions s on s.schedule_id::text=a.schedule_id::text" not in sql_text:
    errors.append("replacement rooms are not restricted to visiting-lecturer sessions")
if "where term_id=selected_term_id and is_active" not in sql_text:
    errors.append("obsolete term QR tokens are not revoked before regeneration")
if "regexp_split_to_table(coalesce(s.instructor::text" in sql_text:
    errors.append("academic_schedule instructor labels must never be split")
if "normalized_name not in ('غير محدد'" in sql_text:
    errors.append("intentional instructor labels must never be excluded")
if "select trim(s.instructor::text) full_name" not in sql_text:
    errors.append("schedule instructor candidates are not preserved as exact row labels")

if errors:
    print("FAILED")
    print("\n".join(f"- {error}" for error in errors))
    sys.exit(1)

print("OK: source, single SQL update, JavaScript, DOM, assets, deployment files, and secret checks passed.")
