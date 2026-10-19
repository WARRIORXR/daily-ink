// Build the Rust core (core/) to WebAssembly and write the JS bindings to
// src/core/. Needs Rust with the wasm32-unknown-unknown target and
// wasm-bindgen-cli 0.2.100:
//   rustup target add wasm32-unknown-unknown
//   cargo install wasm-bindgen-cli --version 0.2.100 --locked
// The output is committed, so `npm run build` (and Vercel) never need Rust.
import { execFileSync } from 'node:child_process'

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })

run('cargo', [
  'build',
  '--manifest-path',
  'core/Cargo.toml',
  '--release',
  '--target',
  'wasm32-unknown-unknown',
])
run('wasm-bindgen', [
  'core/target/wasm32-unknown-unknown/release/daily_ink_core.wasm',
  '--target',
  'web',
  '--out-dir',
  'src/core',
  '--out-name',
  'daily_ink_core',
  '--no-typescript',
])
