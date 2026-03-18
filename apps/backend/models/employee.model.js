import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class Employee extends Model { }

Employee.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    position: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    lms_username: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    lms_password: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    lms_access_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lms_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "Employee",
    tableName: "sl_employees",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["company_id", "email"],
      },
    ],
  }
);

export default Employee;
