import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export async function createGitFixture(parent) {
  const root = path.join(parent, 'git-workflow');
  await mkdir(path.join(root, 'src/content'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'studio-git-fixture', private: true, packageManager: 'npm@10.9.8', dependencies: { astro: '*' }, scripts: { dev: 'astro dev' } }));
  await writeFile(path.join(root, 'src/content/post.md'), '---\ntitle: Before\n---\nOriginal body\n');
  execFileSync('git', ['init', '-b', 'main', root], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'add', '--', 'package.json', 'src/content/post.md']);
  execFileSync('git', ['-C', root, '-c', 'user.name=Astro Studio Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'test: create disposable content fixture'], { stdio: 'pipe' });
  await writeFile(path.join(root, 'src/content/post.md'), '---\ntitle: After save\n---\nOriginal body\n');
  return root;
}
