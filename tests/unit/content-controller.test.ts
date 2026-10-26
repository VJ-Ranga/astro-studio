import { mkdtemp, mkdir, writeFile, rm, symlink, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { ContentController } from '../../src/content/content-controller';
import * as listing from '../../src/content/list-entries';

const roots: string[] = [];
async function fixture(title: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'astro content controller '));
  roots.push(root);
  await mkdir(path.join(root, 'src/content'), { recursive: true });
  await writeFile(path.join(root, 'src/content/post.md'), `---\ntitle: ${title}\n---\nOriginal body\n`);
  return root;
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

it('opens only a currently authorized entry without changing source', async () => {
  const root = await fixture('First');
  const nativeOpen = vi.fn().mockResolvedValue(undefined);
  const controller = new ContentController({ openDocument: nativeOpen });
  await controller.load(root);
  const entry = controller.snapshot.entries[0]!;
  expect(entry.fields.title).toBe('First');
  await controller.open(entry.id);
  expect(nativeOpen).toHaveBeenCalledWith(path.join(root, 'src/content/post.md'));
  expect(await readFile(path.join(root, 'src/content/post.md'), 'utf8')).toContain('Original body');
  await expect(controller.open('not-a-current-entry')).rejects.toThrow('current scan');
  expect(nativeOpen).toHaveBeenCalledTimes(1);
});

it('rejects entry IDs from a previously selected project', async () => {
  const nativeOpen = vi.fn();
  const controller = new ContentController({ openDocument: nativeOpen });
  await controller.load(await fixture('Old'));
  const old = controller.snapshot.entries[0]!.id;
  await controller.load(await fixture('New'));
  await expect(controller.open(old)).rejects.toThrow('current scan');
  expect(nativeOpen).not.toHaveBeenCalled();
});

it('rechecks containment when a file becomes an escaping symlink after discovery', async () => {
  const root = await fixture('Inside');
  const other = await fixture('Outside');
  const nativeOpen = vi.fn();
  const controller = new ContentController({ openDocument: nativeOpen });
  await controller.load(root);
  const id = controller.snapshot.entries[0]!.id;
  await unlink(path.join(root, 'src/content/post.md'));
  await symlink(path.join(other, 'src/content/post.md'), path.join(root, 'src/content/post.md'));
  await expect(controller.open(id)).rejects.toThrow('outside');
  expect(nativeOpen).not.toHaveBeenCalled();
});

it('discards a late scan after switching projects', async () => {
  const old = await fixture('Old');
  const fresh = await fixture('New');
  const previous = await listing.listEntries(old);
  let resolve!: (scan: listing.ContentScan) => void;
  vi.spyOn(listing, 'listEntries').mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const controller = new ContentController({ openDocument: vi.fn() });
  const pending = controller.load(old);
  await vi.waitFor(() => expect(listing.listEntries).toHaveBeenCalledOnce());
  await controller.load(fresh);
  resolve(previous);
  await pending;
  expect(controller.snapshot.entries[0]?.fields.title).toBe('New');
});

it('invalidates entry authorization when disposed', async () => {
  const controller = new ContentController({ openDocument: vi.fn() });
  await controller.load(await fixture('Entry'));
  const id = controller.snapshot.entries[0]!.id;
  controller.dispose();
  await expect(controller.open(id)).rejects.toThrow('current scan');
});
it('retains entries and authorization while refreshing saved files in the same project', async () => {
  const root = await fixture('Before');
  const nativeOpen = vi.fn();
  const controller = new ContentController({ openDocument: nativeOpen });
  await controller.load(root);
  const old = controller.snapshot.entries[0]!;
  await writeFile(path.join(root, 'src/content/post.md'), '---\ntitle: After save\n---\nBody');
  const next = await listing.listEntries(root);
  let resolve!: (scan: listing.ContentScan) => void;
  vi.spyOn(listing, 'listEntries').mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const refresh = controller.refresh();
  expect(controller.snapshot.entries[0]?.fields.title).toBe('Before');
  await controller.open(old.id);
  resolve(next);
  await refresh;
  expect(controller.snapshot.entries[0]?.fields.title).toBe('After save');
  expect(controller.snapshot.entries[0]?.id).toBe(old.id);
});
it('replays a saved-file refresh that arrives during the initial scan', async () => {
  const root = await fixture('Before');
  const before = await listing.listEntries(root);
  let resolve!: (scan: listing.ContentScan) => void;
  vi.spyOn(listing, 'listEntries').mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const controller = new ContentController({ openDocument: vi.fn() });
  const initial = controller.load(root);
  await vi.waitFor(() => expect(listing.listEntries).toHaveBeenCalledOnce());
  await writeFile(path.join(root, 'src/content/post.md'), '---\ntitle: Latest save\n---\nBody');
  await controller.refresh();
  resolve(before);
  await initial;
  expect(controller.snapshot.entries[0]?.fields.title).toBe('Latest save');
});
