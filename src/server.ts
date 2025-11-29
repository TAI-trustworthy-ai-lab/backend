import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

console.log("Loaded LLM_API_KEY:", process.env.LLM_API_KEY ? "OK" : "MISSING");

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
