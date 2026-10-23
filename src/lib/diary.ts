import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const addDiaryEntry = async (action: string, emotion: string, comment: string) => {
  try {
    const docRef = await addDoc(collection(db, 'entries'), {
      action,
      emotion,
      comment,
      createdAt: serverTimestamp(), // Это поможет нам сортировать по времени
    });
    console.log("Запись добавлена с ID: ", docRef.id);
  } catch (e) {
    console.error("Ошибка при добавлении: ", e);
  }
};