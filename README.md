had to do it eventually
spent the summers getting into normie webdevslop
so uhh why not ig
tried to vibecode as less as possible
never again.

---

Rebuilt on Hugo. To work on it locally:

```
npm install       # installs three (asset pipeline) and dart-sass (SCSS build)
hugo server -D    # dev server with drafts, live reload
hugo --gc --minify  # production build -> public/
```

Content lives in `data/*.yaml` (experience, projects, skills, etc.) and
`content/writing/*` (blog posts, Markdown). Design system is in
`assets/scss/`, templates in `layouts/`, client JS in `assets/js/`.

