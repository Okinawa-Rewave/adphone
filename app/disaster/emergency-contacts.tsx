import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Phone, Plus, Trash2 } from 'lucide-react-native';
import { Design } from '@/constants/Design';
import { ScreenLayout } from '@/components/ScreenLayout';
import AsyncStorage from '@react-native-async-storage/async-storage';

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
};

const STORAGE_KEY = '@emergency_contacts';

const DEFAULT_CONTACTS: EmergencyContact[] = [
  { id: '110', name: '警察', phone: '110', relationship: '緊急' },
  { id: '119', name: '消防・救急', phone: '119', relationship: '緊急' },
];

export default function EmergencyContactsScreen() {
  const [contacts, setContacts] = useState<EmergencyContact[]>(DEFAULT_CONTACTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relationship: '' });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setContacts([...DEFAULT_CONTACTS, ...parsed]);
      }
    } catch (e) {
      console.error('Failed to load contacts:', e);
    }
  };

  const saveContacts = async (newContacts: EmergencyContact[]) => {
    try {
      const customContacts = newContacts.filter(
        (c) => !DEFAULT_CONTACTS.find((d) => d.id === c.id)
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(customContacts));
      setContacts(newContacts);
    } catch (e) {
      console.error('Failed to save contacts:', e);
    }
  };

  const handleAddContact = () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      Alert.alert('エラー', '名前と電話番号を入力してください');
      return;
    }
    const contact: EmergencyContact = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      phone: newContact.phone.trim(),
      relationship: newContact.relationship.trim() || undefined,
    };
    const updated = [...contacts, contact];
    saveContacts(updated);
    setNewContact({ name: '', phone: '', relationship: '' });
    setShowAddForm(false);
  };

  const handleDeleteContact = (id: string) => {
    if (DEFAULT_CONTACTS.some((c) => c.id === id)) {
      Alert.alert('エラー', 'デフォルトの連絡先は削除できません');
      return;
    }
    Alert.alert('削除確認', 'この連絡先を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          const updated = contacts.filter((c) => c.id !== id);
          saveContacts(updated);
        },
      },
    ]);
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <ScreenLayout title="緊急連絡先" subtitle="災害時に連絡する先" contentStyle={styles.content}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {contacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                {contact.relationship && (
                  <Text style={styles.contactRelationship}>{contact.relationship}</Text>
                )}
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(contact.phone)}
                >
                  <Phone size={22} color={Design.colors.white} />
                </TouchableOpacity>
                {!DEFAULT_CONTACTS.some((c) => c.id === contact.id) && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteContact(contact.id)}
                  >
                    <Trash2 size={20} color={Design.colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.formTitle}>新しい連絡先を追加</Text>
              <TextInput
                style={styles.input}
                placeholder="名前"
                placeholderTextColor={Design.colors.textMuted}
                value={newContact.name}
                onChangeText={(text) =>
                  setNewContact({ ...newContact, name: text })
                }
              />
              <TextInput
                style={styles.input}
                placeholder="電話番号"
                placeholderTextColor={Design.colors.textMuted}
                value={newContact.phone}
                onChangeText={(text) =>
                  setNewContact({ ...newContact, phone: text })
                }
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="関係（任意）例：家族、友人"
                placeholderTextColor={Design.colors.textMuted}
                value={newContact.relationship}
                onChangeText={(text) =>
                  setNewContact({ ...newContact, relationship: text })
                }
              />
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={() => {
                    setShowAddForm(false);
                    setNewContact({ name: '', phone: '', relationship: '' });
                  }}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, styles.saveButton]}
                  onPress={handleAddContact}
                >
                  <Text style={styles.saveButtonText}>追加</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {!showAddForm && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}
            activeOpacity={0.8}
          >
            <Plus size={22} color={Design.colors.white} />
            <Text style={styles.addButtonText}>連絡先を追加</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Design.spacing.lg, paddingTop: Design.spacing.lg },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  contactCard: {
    backgroundColor: Design.colors.background,
    borderRadius: Design.radius.lg,
    padding: Design.spacing.lg,
    marginBottom: Design.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
    marginBottom: Design.spacing.xs,
  },
  contactRelationship: {
    fontSize: Design.fontSize.caption,
    color: Design.colors.textMuted,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: Design.fontSize.body,
    color: Design.colors.textSecondary,
  },
  contactActions: {
    flexDirection: 'row',
    gap: Design.spacing.sm,
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: Design.colors.success,
    width: 48,
    height: 48,
    borderRadius: Design.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: Design.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Design.colors.danger,
  },
  addForm: {
    backgroundColor: Design.colors.background,
    borderRadius: Design.radius.lg,
    padding: Design.spacing.lg,
    marginBottom: Design.spacing.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
  },
  formTitle: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
    marginBottom: Design.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: Design.colors.border,
    borderRadius: Design.radius.md,
    paddingHorizontal: Design.spacing.lg,
    paddingVertical: Design.spacing.md,
    marginBottom: Design.spacing.md,
    fontSize: Design.fontSize.body,
    backgroundColor: Design.colors.background,
    color: Design.colors.text,
  },
  formActions: {
    flexDirection: 'row',
    gap: Design.spacing.sm,
    marginTop: Design.spacing.sm,
  },
  formButton: {
    flex: 1,
    paddingVertical: Design.spacing.md,
    borderRadius: Design.radius.md,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: Design.colors.surface },
  cancelButtonText: {
    color: Design.colors.textSecondary,
    fontWeight: Design.fontWeight.semi,
    fontSize: Design.fontSize.body,
  },
  saveButton: { backgroundColor: Design.colors.primary },
  saveButtonText: {
    color: Design.colors.white,
    fontWeight: Design.fontWeight.semi,
    fontSize: Design.fontSize.body,
  },
  addButton: {
    position: 'absolute',
    bottom: Design.spacing.lg,
    left: Design.spacing.lg,
    right: Design.spacing.lg,
    backgroundColor: Design.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Design.spacing.lg,
    borderRadius: Design.radius.lg,
    gap: Design.spacing.sm,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonText: {
    color: Design.colors.white,
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
  },
});
