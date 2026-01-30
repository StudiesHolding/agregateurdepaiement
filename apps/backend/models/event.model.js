import { DataTypes, Model } from "sequelize";
import { PaymentProvider } from "./PaymentProvider.model";
import { sequelize } from "../db/sequelise";

export class Event extends Model {}

Event.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            primaryKey: true
        },
        type: {
            type: DataTypes.STRING,
        },
        payloads: {
            type: DataTypes.JSON
        },
        signatureValid: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        processed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        }
    }, {
        tableName: "aggp_weebhook_event",
        sequelize
    }

)

Event.Provider = Event.belongsTo(PaymentProvider)