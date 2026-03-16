import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class PostMeta extends Model {}

PostMeta.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: "meta_id",
    },
    postId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "post_id",
    },
    metaKey: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "meta_key",
    },
    metaValue: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      field: "meta_value",
    },
  },
  {
    sequelize,
    modelName: "PostMeta",
    tableName: "kyd4_postmeta",
    timestamps: false,
    freezeTableName: true,
  }
);

export default PostMeta;
