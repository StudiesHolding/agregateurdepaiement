import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class Course extends Model {}

Course.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: "ID",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "post_title",
    },
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      field: "post_content",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "post_status",
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "post_type",
    },
    authorId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "post_author",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "post_date",
    },
  },
  {
    sequelize,
    modelName: "Course",
    tableName: "kyd4_posts",
    timestamps: false, // WordPress handles its own dates
    freezeTableName: true,
  }
);

export default Course;
