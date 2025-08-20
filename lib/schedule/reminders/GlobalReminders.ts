// lib/schedule/reminders/GlobalReminders.ts
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ReminderManager } from './ReminderManager';

export class GlobalReminders {
	private static instance: GlobalReminders;
	private reminderManager: ReminderManager;

	private constructor() {
		this.reminderManager = ReminderManager.getInstance();
	}

	public static getInstance(): GlobalReminders {
		if (!GlobalReminders.instance) {
			GlobalReminders.instance = new GlobalReminders();
		}
		return GlobalReminders.instance;
	}


	async fetchSchedules(): Promise<{ schedules: any[] }> {
		const schedulesQuery = query(collection(db, 'schedules'));

		const schedulesSnapshot = await getDocs(schedulesQuery);
		const schedules = schedulesSnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		}));
		return { schedules };
	}

	async checkAndProcessReminders() {
		const { schedules } = await this.fetchSchedules();
		await this.reminderManager.processReminders(schedules);
	}
}
