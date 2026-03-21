// app/disaster/checklist.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { Design } from '@/constants/Design';
import { ScreenLayout } from '@/components/ScreenLayout';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ChecklistItem = {
  id: string;
  name: string;
  category: string;
  checked: boolean;
};

const INITIAL_ITEMS: ChecklistItem[] = [
  // 飲料・食料
  { id: '1', name: '飲料水（1人3日分、1日3リットル）', category: '飲料・食料', checked: false },
  { id: '2', name: '非常食（缶詰、レトルト食品など）', category: '飲料・食料', checked: false },
  { id: '3', name: 'カセットコンロ・ガスボンベ', category: '飲料・食料', checked: false },
  { id: '4', name: '食器類（紙皿、割り箸など）', category: '飲料・食料', checked: false },
  
  // 貴重品・重要書類
  { id: '5', name: '現金（小銭も含む）', category: '貴重品・重要書類', checked: false },
  { id: '6', name: '預金通帳・印鑑', category: '貴重品・重要書類', checked: false },
  { id: '7', name: '健康保険証・各種カード', category: '貴重品・重要書類', checked: false },
  { id: '8', name: '免許証・パスポート', category: '貴重品・重要書類', checked: false },
  
  // 医療・衛生用品
  { id: '9', name: '救急セット（絆創膏、消毒液など）', category: '医療・衛生用品', checked: false },
  { id: '10', name: '常備薬・処方箋', category: '医療・衛生用品', checked: false },
  { id: '11', name: 'マスク', category: '医療・衛生用品', checked: false },
  { id: '12', name: 'ウェットティッシュ・除菌シート', category: '医療・衛生用品', checked: false },
  { id: '13', name: 'トイレットペーパー', category: '医療・衛生用品', checked: false },
  
  // 情報・連絡手段
  { id: '14', name: '携帯電話・充電器', category: '情報・連絡手段', checked: false },
  { id: '15', name: 'モバイルバッテリー', category: '情報・連絡手段', checked: false },
  { id: '16', name: 'ラジオ（電池式または手回し式）', category: '情報・連絡手段', checked: false },
  { id: '17', name: '懐中電灯・ランタン', category: '情報・連絡手段', checked: false },
  { id: '18', name: '予備電池', category: '情報・連絡手段', checked: false },
  
  // 衣類・寝具
  { id: '19', name: '下着・靴下（数日分）', category: '衣類・寝具', checked: false },
  { id: '20', name: '防寒着・雨具', category: '衣類・寝具', checked: false },
  { id: '21', name: '毛布・寝袋', category: '衣類・寝具', checked: false },
  { id: '22', name: 'タオル', category: '衣類・寝具', checked: false },
  
  // その他
  { id: '23', name: 'ロープ・工具', category: 'その他', checked: false },
  { id: '24', name: '軍手・作業用手袋', category: 'その他', checked: false },
  { id: '25', name: 'ライター・マッチ', category: 'その他', checked: false },
  { id: '26', name: 'ビニール袋（大小各種）', category: 'その他', checked: false },
];

const STORAGE_KEY = '@disaster_checklist';

export default function DisasterChecklistScreen() {
  const [items, setItems] = useState<ChecklistItem[]>(INITIAL_ITEMS);

  // 保存されたデータを読み込む
  useEffect(() => {
    loadChecklist();
  }, []);

  const loadChecklist = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setItems(parsed);
      }
    } catch (e) {
      console.error('Failed to load checklist:', e);
    }
  };

  // チェックリストを保存
  const saveChecklist = async (newItems: ChecklistItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch (e) {
      console.error('Failed to save checklist:', e);
    }
  };

  const toggleItem = (id: string) => {
    const newItems = items.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setItems(newItems);
    saveChecklist(newItems);
  };

  const categories = Array.from(new Set(items.map(item => item.category)));
  const checkedCount = items.filter(item => item.checked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <ScreenLayout
      title="防災グッズ"
      subtitle={`準備状況: ${checkedCount}/${totalCount} (${Math.round(progress)}%)`}
      contentStyle={styles.content}
    >
      <View style={styles.container}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {categories.map(category => {
            const categoryItems = items.filter(item => item.category === category);
            return (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {categoryItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemRow}
                    onPress={() => toggleItem(item.id)}
                  >
                    <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                      {item.checked && <Check size={16} color="#ffffff" />}
                    </View>
                    <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Design.spacing.lg, paddingTop: Design.spacing.lg },
  container: {
    flex: 1,
  },
  progressBar: {
    height: 10,
    backgroundColor: Design.colors.border,
    marginBottom: Design.spacing.md,
    borderRadius: Design.radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Design.colors.success,
    borderRadius: Design.radius.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Design.spacing.xxl,
  },
  categorySection: {
    marginBottom: Design.spacing.xxl,
  },
  categoryTitle: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
    marginBottom: Design.spacing.md,
    paddingBottom: Design.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: Design.colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Design.spacing.md,
    paddingHorizontal: Design.spacing.xs,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: Design.radius.sm,
    borderWidth: 2,
    borderColor: Design.colors.border,
    marginRight: Design.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Design.colors.background,
  },
  checkboxChecked: {
    backgroundColor: Design.colors.success,
    borderColor: Design.colors.success,
  },
  itemText: {
    flex: 1,
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    lineHeight: 24,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: Design.colors.textMuted,
  },
});
