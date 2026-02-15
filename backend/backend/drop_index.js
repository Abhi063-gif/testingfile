const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" }); // Load env vars

const DB = process.env.DBURI.replace("<db_password>", process.env.DBPASSWORD);

mongoose
    .connect(DB, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(async () => {
        console.log("DB connected successfully!");

        try {
            const collection = mongoose.connection.collection("users");
            // List indexes to confirm
            const indexes = await collection.indexes();
            console.log("Current Indexes:", indexes);

            const indexName = "username_1";
            const indexExists = indexes.find(idx => idx.name === indexName);

            if (indexExists) {
                console.log(`Dropping index: ${indexName}...`);
                await collection.dropIndex(indexName);
                console.log("Index dropped successfully!");
            } else {
                console.log("Index 'username_1' not found, it might have been already removed.");
            }

        } catch (err) {
            console.error("Error dropping index:", err);
        } finally {
            console.log("Exiting...");
            process.exit();
        }
    })
    .catch((err) => {
        console.log("DB Connection Error:", err);
        process.exit(1);
    });
