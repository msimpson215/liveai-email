# Business source documents → product playbooks

Upload PDFs, docx, or zip files here via GitHub. Each product has its own AI playbook in `server/server.js`.

**Walk through demos one by one:** https://liveai-email.onrender.com/demo/catalog.html

1. Open: https://github.com/msimpson215/liveai-email/upload/main/docs/business-brains  
2. Drag files onto the page  
3. Commit changes  
4. Tell the agent **uploaded**

After upload: `npm run ingest-brains` (unzip + extract text → `extracted/`)

Full catalog: `docs/product-playbooks/CATALOG.md`