# Push this final build to the private GitHub repository

Repository:

```text
https://github.com/adnan045/global-digital-ranking
```

Do not share GitHub passwords, personal access tokens, Supabase service-role keys or Resend keys in chat.

## Recommended method: clone the private repo first

From your terminal:

```bash
git clone https://github.com/adnan045/global-digital-ranking.git
cd global-digital-ranking
```

Copy the contents of this final package into the cloned folder, replacing existing files. Then run:

```bash
npm run build
git add .
git commit -m "Complete GDR website, lead funnel and CRM"
git push origin main
```

If your default branch is `master`, use:

```bash
git push origin master
```

Vercel should automatically redeploy when the push is complete.

## If the repository is empty

You can also run from the final package folder:

```bash
git init
git branch -M main
git remote add origin https://github.com/adnan045/global-digital-ranking.git
npm run build
git add .
git commit -m "Initial Global Digital Ranking website"
git push -u origin main
```

## Vercel after push

In Vercel, confirm:

- Build command: `npm run build`
- Output directory: `public`
- Root directory: repository root

Then add the Supabase environment variables from `README.md` in Vercel Project Settings before testing the CRM.
