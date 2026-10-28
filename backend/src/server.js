import { app } from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API do Almoxarifado da Câmara de Tatuí rodando em http://localhost:${PORT}`);
});
