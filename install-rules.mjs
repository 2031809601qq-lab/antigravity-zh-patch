#!/usr/bin/env node
/**
 * antigravity-zh-patch · 中文思考与状态提示全局规则一键安装器 (install-rules.mjs)
 *
 * 零第三方依赖，兼容 Windows / macOS / Linux。
 * 默认将仓库内的 rules/chinese-thinking.md 幂等部署至 ~/.gemini/config/rules/chinese-thinking.md
 *
 * 用法：
 *   node install-rules.mjs              # 幂等安装/更新中文思考全局规则
 *   node install-rules.mjs install      # 同上
 *   node install-rules.mjs --uninstall  # 移除已安装的中文思考全局规则（亦支持 uninstall 子命令）
 *   node install-rules.mjs --status     # 查看当前规则安装状态（亦支持 status 子命令）
 *   node install-rules.mjs [--target-dir <dir>]  # 可选：指定自定义目标 rules 目录
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULE_FILENAME = 'chinese-thinking.md';
const SOURCE_FILE = path.join(__dirname, 'rules', RULE_FILENAME);

const args = process.argv.slice(2);
const hasFlag = (flag) => args.some((a) => a === flag || a.startsWith(`${flag}=`));

function getArg(flag, fallback = null) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) return args[i + 1];
    if (args[i].startsWith(`${flag}=`)) return args[i].slice(flag.length + 1);
  }
  return fallback;
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function resolveTargetRulesDir() {
  const customDir = getArg('--target-dir');
  if (customDir) return path.resolve(customDir);
  return path.join(os.homedir(), '.gemini', 'config', 'rules');
}

function resolveAction() {
  if (hasFlag('--help') || hasFlag('-h') || args.includes('help')) return 'help';
  if (hasFlag('--uninstall') || hasFlag('-u') || args.includes('uninstall') || args.includes('remove')) {
    return 'uninstall';
  }
  if (hasFlag('--status') || args.includes('status')) return 'status';
  return 'install';
}

function run() {
  const action = resolveAction();
  const targetDir = resolveTargetRulesDir();
  const targetFile = path.join(targetDir, RULE_FILENAME);

  if (action === 'help') {
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'help',
          usage: [
            'node install-rules.mjs',
            'node install-rules.mjs --uninstall',
            'node install-rules.mjs --status',
            'node install-rules.mjs [--target-dir <dir>]'
          ],
          defaultTargetFile: path.join(os.homedir(), '.gemini', 'config', 'rules', RULE_FILENAME)
        },
        null,
        2
      )
    );
    return;
  }

  if (action === 'uninstall') {
    let removed = false;
    let status = 'not_installed';
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
      removed = true;
      status = 'removed';
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'uninstall',
          status,
          removed,
          platform: process.platform,
          targetDir,
          targetFile
        },
        null,
        2
      )
    );
    return;
  }

  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          action,
          error: `Source rule file not found: ${SOURCE_FILE}`
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const rawSource = fs.readFileSync(SOURCE_FILE, 'utf8').replace(/\r\n/g, '\n');
  const sourceBuf = Buffer.from(rawSource, 'utf8');
  const sourceSha256 = sha256Buffer(sourceBuf);

  if (action === 'status') {
    const installed = fs.existsSync(targetFile);
    let targetSha256 = null;
    let upToDate = false;
    if (installed) {
      const existingNormalized = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');
      targetSha256 = sha256Buffer(Buffer.from(existingNormalized, 'utf8'));
      upToDate = targetSha256 === sourceSha256;
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'status',
          installed,
          upToDate,
          platform: process.platform,
          sourceFile: SOURCE_FILE,
          targetDir,
          targetFile,
          sourceSha256,
          targetSha256
        },
        null,
        2
      )
    );
    return;
  }

  // 默认执行幂等安装 (install)
  fs.mkdirSync(targetDir, { recursive: true });

  let status = 'installed';
  let changed = true;

  if (fs.existsSync(targetFile)) {
    const existingBuf = fs.readFileSync(targetFile);
    const existingSha256 = sha256Buffer(existingBuf);
    if (existingSha256 === sourceSha256) {
      status = 'already_up_to_date';
      changed = false;
    } else {
      fs.writeFileSync(targetFile, sourceBuf);
      status = 'updated';
      changed = true;
    }
  } else {
    fs.writeFileSync(targetFile, sourceBuf);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'install',
        status,
        changed,
        platform: process.platform,
        sourceFile: SOURCE_FILE,
        targetDir,
        targetFile,
        sha256: sourceSha256,
        bytes: sourceBuf.length
      },
      null,
      2
    )
  );
}

try {
  run();
} catch (err) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: err && err.message ? err.message : String(err)
      },
      null,
      2
    )
  );
  process.exit(1);
}
