"""Preserve raw provenance while exposing only unresolved layout ambiguities."""
from ideal_journal_rules import resolve_standalone_void_products


def layout_evidence(group):
    _, residual, resolved = resolve_standalone_void_products(group)
    # An orphan flag with no proven relationship must not disappear.
    if 'standalone_void_relationship' in group['ambiguities'] and not resolved:
        residual = list(set(residual) | {'standalone_void_relationship'})
    return {'ambiguities': sorted(set(residual)),
            'rawLayoutAmbiguities': list(group['ambiguities']),
            'resolvedStandaloneVoidRelationships': resolved}
