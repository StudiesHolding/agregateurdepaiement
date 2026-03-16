import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import bcrypt from "bcrypt";

export class CompanyAdmin extends Model {
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password_hash);
  }
}

CompanyAdmin.init(
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
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("admin", "manager"),
      defaultValue: "admin",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "CompanyAdmin",
    tableName: "sl_company_admins",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeSave: async (admin) => {
        if (admin.changed("password_hash")) {
          const salt = await bcrypt.genSalt(10);
          admin.password_hash = await bcrypt.hash(admin.password_hash, salt);
        }
      },
    },
  }
);

export default CompanyAdmin;
