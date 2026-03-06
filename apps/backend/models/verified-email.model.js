import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class VerifiedEmail extends Model { }

VerifiedEmail.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        verificationCode: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        codeExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        verifiedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        lastVerificationAttemptAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        attemptsCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        }
    },
    {
        sequelize,
        modelName: "VerifiedEmail",
        tableName: "aggp_verified_emails",
        indexes: [
            {
                unique: true,
                fields: ['email']
            }
        ]
    }
);
