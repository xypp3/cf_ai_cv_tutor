# README

## About
This is project is a browser to help fine tune your CV for each job description.
It uses Cloudflare Workers AI to analyse your CV against the job description and suggest improvements.
This project is batters **not** included so you'll need to use your own Cloudflare API keys and such.

## How to run

Since this is a browser extension all installing and building is done in the `extension/` directory.

```bash
cd extension/
```

### Requirements
```bash
npm
npx
```

### Installing deps
```bash
npm install
```

### Dev build
Dev environment vars example can be found in `extension/.env.development.example`. 

Then to run in dev mode please run:
```bash
npm run build -- --mode development
```

### Prod build
```bash
npm run build
```

## How to add extension
*First you need to have build the project following the steps above*

### Firefox
1. Go to the URL `about:debugging#/runtime/this-firefox`
2. Click "Load temporary add-on"
3. Navigate to the `dist/manifest.json` and select/double click/open it
4. Now extension should appear with your other ones
5. On job website click on extension and it should prompt you to analyse your CV and job description

### Chrome
1. Go to URL `chrome://extensions`
2. Click on "Load unpacked"
3. Select the `dist/` extension directory
4. Now extension should appear with your other ones
5. On job website click on extension and it should prompt you to analyse your CV and job description
