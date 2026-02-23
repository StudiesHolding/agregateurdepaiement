import { DataTypes, Model } from 'sequelize';
import  sequelize  from '../config/database.js';

class NotificationSettings extends Model { }

NotificationSettings.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    adminEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'admin_email'
    },
    notifyOnSuccess: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'notify_on_success'
    },
    notifyOnFailure: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'notify_on_failure'
    },
    notifyOnSuspicious: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'notify_on_suspicious'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    }
}, {
    sequelize,
    modelName: 'NotificationSettings',
    tableName: 'aggp_notification_settings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export { NotificationSettings };
