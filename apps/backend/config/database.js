import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(
    process.env.DATABASE_NAME,
    process.env.DATABASE_USER,
    process.env.DATABASE_PASSWORD,
    {
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT || 3306,
        dialect: "mysql",
        logging: false,
        pool: {
            max: 50,
            min: 5,
            acquire: 30000,
            idle: 10000
        },
        define: {
            underscored: true,
            timestamps: true,
            freezeTableName: true,
        },
    }
);

export default sequelize;
