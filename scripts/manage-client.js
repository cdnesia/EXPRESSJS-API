// Single interactive CLI for everything client-related: register a new
// client, or manage an existing one (regenerate its secret, change its
// scopes, or both independently). Kept as one entry point on purpose —
// npm run manage-client — instead of a separate script per action.
const { input, search, checkbox, confirm, select } = require('@inquirer/prompts');
const authService = require('../src/services/auth.service');
const prisma = require('../src/config/prisma');
const requireScope = require('../src/middlewares/requireScope');
const ui = require('./lib/ui');

// Requiring the routes loads every route file, and each requireScope('x')
// call inside them registers its scope as a side effect — this is what
// populates requireScope.getRegisteredScopes() below, with no separate list
// to keep in sync by hand.
require('../src/routes');
const KNOWN_SCOPES = requireScope.getRegisteredScopes();

function scopeChoices(currentScopes = []) {
  return KNOWN_SCOPES.map((scope) => ({ name: scope, value: scope, checked: currentScopes.includes(scope) }));
}

async function createClient() {
  ui.section('Client baru');

  const name = await input({
    message: 'Nama client:',
    validate: (value) => {
      const trimmed = value.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return 'Nama harus 2-100 karakter.';
      }
      return true;
    },
  });

  const scopes = await checkbox({
    message: 'Pilih scope (spasi untuk pilih, enter untuk lanjut):',
    choices: scopeChoices(),
  });

  ui.section('Ringkasan');
  ui.kv('Nama', name.trim());
  ui.kv('Scopes', ui.scopeText(scopes));
  console.log();

  const proceed = await confirm({ message: 'Lanjutkan daftar client ini?', default: false });
  if (!proceed) {
    ui.warn('Dibatalkan.');
    return;
  }

  const client = await authService.register({ name: name.trim(), scopes });

  ui.success('Client berhasil didaftarkan.');
  ui.credentialsBox([
    { label: 'clientId', value: client.clientId },
    { label: 'clientSecret', value: client.clientSecret, emphasize: true },
    { label: 'Scopes', value: ui.scopeText(client.scopes), raw: true },
  ]);
}

async function pickClient() {
  const clients = await authService.listAll();

  const id = await search({
    message: 'Cari client (ketik nama atau clientId):',
    source: (term) => {
      const filtered = !term
        ? clients
        : clients.filter(
            (c) =>
              c.name.toLowerCase().includes(term.toLowerCase()) ||
              c.clientId.toLowerCase().includes(term.toLowerCase())
          );

      if (filtered.length === 0) {
        return [{ name: '(tidak ada client cocok)', value: null, disabled: true }];
      }

      return filtered.map((c) => ({
        name: `${c.name}  [${c.clientId}]  scopes: ${c.scopes.length ? c.scopes.join(', ') : '(tidak ada)'}`,
        value: c.id,
      }));
    },
  });

  return clients.find((c) => c.id === id);
}

async function manageClient() {
  const client = await pickClient();

  ui.section('Client dipilih');
  ui.kv('Nama', client.name);
  ui.kv('clientId', client.clientId);
  ui.kv('Scopes', ui.scopeText(client.scopes));

  const actions = await checkbox({
    message: 'Apa yang mau diubah? (tekan spasi untuk centang, enter untuk lanjut)',
    validate: (choices) =>
      choices.length > 0 || 'Pilih minimal satu: tekan spasi di salah satu opsi, baru enter.',
    choices: [
      { name: 'Generate ulang client secret', value: 'secret' },
      { name: 'Ubah scope', value: 'scope' },
    ],
  });

  if (actions.includes('secret')) {
    const proceed = await confirm({
      message: 'Yakin generate ulang secret? Secret lama langsung tidak berlaku.',
      default: false,
    });

    if (proceed) {
      const updated = await authService.regenerateSecret(client.id);
      ui.credentialsBox([
        { label: 'clientId', value: client.clientId },
        { label: 'clientSecret', value: updated.clientSecret, emphasize: true },
      ]);
    } else {
      ui.warn('Lewati generate ulang secret.');
    }
  }

  if (actions.includes('scope')) {
    const scopes = await checkbox({
      message: 'Pilih scope baru (spasi untuk pilih, enter untuk lanjut):',
      choices: scopeChoices(client.scopes),
    });

    ui.section('Scope baru');
    ui.kv('Scopes', ui.scopeText(scopes));
    console.log();

    const proceed = await confirm({ message: 'Simpan scope ini?', default: true });

    if (proceed) {
      await authService.updateScopes(client.id, scopes);
      ui.success('Scope berhasil diperbarui.');
    } else {
      ui.warn('Lewati perubahan scope.');
    }
  }

  console.log();
  ui.success('Selesai.');
}

async function main() {
  ui.banner('Kelola Client API');

  const mode = await select({
    message: 'Mau apa?',
    choices: [
      { name: 'Daftarkan client baru', value: 'create' },
      { name: 'Kelola client yang sudah ada', value: 'manage' },
    ],
  });

  if (mode === 'create') {
    await createClient();
  } else {
    await manageClient();
  }
}

main()
  .catch((err) => {
    ui.error(`Gagal: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
