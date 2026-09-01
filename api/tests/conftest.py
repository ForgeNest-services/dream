"""Importing features.auth first (same as main.py's own top-level import
order) resolves core.deps fully before any test module imports from
features.ims/features.restro directly — those packages' __init__.py eagerly
imports their own router, which imports core.deps, which imports
features.auth.repository, which (via Python importing the parent package
first) re-triggers features.auth's own __init__ -> router -> core.deps
cycle if features.auth hasn't been fully initialized yet. main.py never
hits this because it happens to import features.auth before features.ims;
this file makes test collection order-independent the same way."""
import features.auth  # noqa: F401
