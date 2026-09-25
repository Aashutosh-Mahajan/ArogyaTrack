"""Collect user-facing API messages for the frontend translation catalogs.

The web app shows backend text as-is (error details, validation messages,
choice labels, disease names), passing it through ``t()``. Listing those
strings here lets the catalogs translate them.

Usage (from backend/):  python scripts/extract_i18n_messages.py > ../frontend/scripts/i18n/backend-messages.json
"""

import ast
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {"venv", "venv_py314_unsupported", "migrations", "__pycache__", "management", "scripts", "ml_models", "static", "media"}
SKIP_FILES = {"tests.py", "settings.py", "agent_service.py", "anonymizer.py", "translations.py"}

messages = {}


def add(text, where):
    if not isinstance(text, str):
        return
    text = text.strip()
    # Only full sentences/labels a person would read; skip codes and dynamic f-strings.
    if not re.search(r"[A-Za-z]{2}", text) or len(text) > 300:
        return
    if re.fullmatch(r"[a-z0-9_\-./:]+", text):
        return
    if not re.search(r"[a-z]", text):  # codes such as "AB-" or "FORBIDDEN"
        return
    messages.setdefault(text, where)


class Visitor(ast.NodeVisitor):
    def __init__(self, where):
        self.where = where

    def _collect(self, node):
        if isinstance(node, ast.Constant):
            add(node.value, self.where)
        elif isinstance(node, (ast.List, ast.Tuple)):
            for e in node.elts:
                self._collect(e)
        elif isinstance(node, ast.Dict):
            for v in node.values:
                self._collect(v)

    def visit_Call(self, node):
        name = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", "")
        if name in {"ValidationError", "PermissionDenied", "NotFound", "AuthenticationFailed", "ParseError", "ValidationErrorList"}:
            for a in node.args:
                self._collect(a)
            for kw in node.keywords:
                if kw.arg in {"detail", "message"}:
                    self._collect(kw.value)
        self.generic_visit(node)

    def visit_Dict(self, node):
        for k, v in zip(node.keys, node.values):
            if isinstance(k, ast.Constant) and k.value in {"detail", "message", "error"}:
                self._collect(v)
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        # TextChoices: FOO = "foo", "Human label"
        for stmt in node.body:
            if isinstance(stmt, ast.Assign) and isinstance(stmt.value, ast.Tuple) and len(stmt.value.elts) == 2:
                label = stmt.value.elts[1]
                if isinstance(label, ast.Constant):
                    add(label.value, self.where)
            if isinstance(stmt, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "message" for t in stmt.targets):
                self._collect(stmt.value)
        self.generic_visit(node)


for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        if not fn.endswith(".py") or fn in SKIP_FILES:
            continue
        path = Path(dirpath) / fn
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        Visitor(str(path.relative_to(ROOT)).replace("\\", "/")).visit(tree)

# Disease names shown across surveillance screens.
try:
    sys.path.insert(0, str(ROOT))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import warnings

    warnings.filterwarnings("ignore")
    import django

    django.setup()
    from surveillance.models import SurveillanceData

    for name in SurveillanceData.objects.values_list("disease_name", flat=True).distinct():
        add(name, "db:surveillance.disease_name")
except Exception as exc:  # the catalog still works without them
    print(f"skipped disease names: {exc}", file=sys.stderr)

out = [{"message": m, "file": f} for m, f in sorted(messages.items())]
sys.stdout.write(json.dumps(out, ensure_ascii=False, indent=1))
print(f"backend messages: {len(out)}", file=sys.stderr)
