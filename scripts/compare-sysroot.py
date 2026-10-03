"""Read-only comparison of the shipped sysroot with the wasi-sdk 25 release archive.

Usage: python scripts/compare-sysroot.py PATH-TO-wasi-sysroot-25.0.tar.gz [PATH-TO-builtins-25.0.tar.gz]
"""

import hashlib
import json
import sys
import tarfile
from pathlib import Path

if len(sys.argv) not in (2, 3):
    raise SystemExit(__doc__)

packed_path = Path(__file__).resolve().parent.parent / "runtime/browsercc-0.1.1/sysroot.tar"
with tarfile.open(packed_path) as packed, tarfile.open(sys.argv[1]) as upstream:
    source_members = {member.name: member for member in upstream if member.isfile()}
    matches = []
    missing = []
    different = []
    excluded = []
    for member in packed:
        if not member.isfile():
            continue
        if member.name.startswith("include/c++/"):
            source = "wasi-sysroot-25.0/include/wasm32-wasi/c++/" + member.name[len("include/c++/"):]
        elif member.name.startswith(("include/wasm32-wasi/", "lib/wasm32-wasi/")):
            source = "wasi-sysroot-25.0/" + member.name
        else:
            excluded.append(member.name)
            continue
        upstream_member = source_members.get(source)
        if upstream_member is None:
            missing.append({"packed": member.name, "expectedSource": source})
            continue
        actual = hashlib.sha256(packed.extractfile(member).read()).hexdigest()
        expected = hashlib.sha256(upstream.extractfile(upstream_member).read()).hexdigest()
        (matches if actual == expected else different).append(member.name)
    builtins_match = None
    if len(sys.argv) == 3:
        with tarfile.open(sys.argv[2]) as builtins:
            source = builtins.extractfile("libclang_rt.builtins-wasm32-wasi-25.0/libclang_rt.builtins-wasm32.a").read()
        member = packed.extractfile("lib/clang/20/lib/wasm32-unknown-wasi/libclang_rt.builtins.a").read()
        builtins_match = {"identical": source == member, "sha256": hashlib.sha256(member).hexdigest(),
                          "bytes": len(member)}
    print(json.dumps({"packed": str(packed_path), "upstream": sys.argv[1],
                      "identicalFiles": len(matches), "missingSourceCount": len(missing),
                      "missingSourceSample": missing[:12], "differentFilesCount": len(different),
                      "differentFilesSample": different[:12],
                      "outsideComparedGroupsCount": len(excluded),
                      "outsideComparedGroupsSample": excluded[:12], "builtins": builtins_match}, indent=2))
