import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// On utilise le .env de l'agrégateur
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function getTestData() {
    console.log("=== EXTRACTION DONNÉES TEST ===");
    
    // 1. MariaDB (Enchères)
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || 'root',
            database: process.env.MYSQL_DATABASE || 'studies_learning_auctions'
        });
        
        // Trouver une enchère fermée avec un winner (si possible)
        const [rows] = await connection.execute('SELECT id, title, status FROM auctions WHERE status = "closed" LIMIT 1');
        if (rows.length > 0) {
            console.log(`[AUCTION] Found closed auction ID: ${rows[0].id} - ${rows[0].title}`);
        } else {
            console.log("[AUCTION] No closed auction found. You may need to create one.");
        }
        await connection.end();
    } catch (e) {
        console.log("[AUCTION] DB connection failed:", e.message);
    }

    // 2. Postgres (Authoring Engine)
    // Au lieu de Prisma (qui peut être complexe à instancier depuis ce dossier), on utilise juste la lib `pg` ou on l'affiche
    console.log("\n=> Pour le cours Moodle (B2C), on peut utiliser l'ID 40 (vu dans le précédent check) ou interroger directement l'Authoring Engine.");
    
    console.log("Extraction terminée.");
}

getTestData();
