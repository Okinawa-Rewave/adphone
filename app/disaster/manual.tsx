// app/disaster/manual.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, AlertTriangle, Home, Building } from 'lucide-react-native';
import { Design } from '@/constants/Design';
import { ScreenLayout } from '@/components/ScreenLayout';

type ManualSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string[];
};

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'earthquake',
    title: '地震が発生したら',
    icon: <AlertTriangle size={24} color={Design.colors.danger} />,
    content: [
      '1. まず身の安全を確保する',
      '   - 机の下などに隠れる',
      '   - 頭を守る（クッション、本など）',
      '   - 揺れが収まるまで待つ',
      '',
      '2. 火の始末',
      '   - ガスコンロの火を消す',
      '   - ストーブを消す',
      '   - ブレーカーを落とす（停電時は不要）',
      '',
      '3. 出口の確保',
      '   - ドアや窓を開けて避難経路を確保',
      '',
      '4. 外に出る際の注意',
      '   - ガラスや看板の落下に注意',
      '   - ブロック塀や電柱から離れる',
      '   - ヘルメットや帽子を着用',
    ],
  },
  {
    id: 'tsunami',
    title: '津波警報が出たら',
    icon: <AlertTriangle size={24} color={Design.colors.danger} />,
    content: [
      '1. すぐに高台へ避難',
      '   - 海や川から離れる',
      '   - できるだけ高い場所へ',
      '   - 車での避難は渋滞の原因になるため徒歩を優先',
      '',
      '2. 避難場所の確認',
      '   - 避難所マップで最寄りの避難所を確認',
      '   - 複数の避難経路を把握',
      '',
      '3. 持ち物',
      '   - 防災グッズを持って避難',
      '   - 重いものは持たない',
      '   - 命が最優先',
    ],
  },
  {
    id: 'fire',
    title: '火災が発生したら',
    icon: <AlertTriangle size={24} color={Design.colors.danger} />,
    content: [
      '1. 初期消火',
      '   - 火が小さいうちに消火器で消火',
      '   - 無理をしない（1分を超えたら避難）',
      '',
      '2. 119番通報',
      '   - 住所、状況を正確に伝える',
      '   - 自分の安全を確保してから通報',
      '',
      '3. 避難',
      '   - 煙を吸わないよう低い姿勢で',
      '   - ハンカチで口と鼻を覆う',
      '   - エレベーターは使わない',
    ],
  },
  {
    id: 'home',
    title: '自宅での備え',
    icon: <Home size={24} color={Design.colors.primary} />,
    content: [
      '1. 家具の固定',
      '   - タンス、本棚は壁に固定',
      '   - テレビは転倒防止対策を',
      '',
      '2. 避難経路の確認',
      '   - 複数の避難経路を確保',
      '   - 非常口の位置を家族で共有',
      '',
      '3. 防災グッズの準備',
      '   - 最低3日分の食料・水',
      '   - 定期的に点検・更新',
      '',
      '4. 家族との連絡方法',
      '   - 集合場所を決めておく',
      '   - 災害用伝言ダイヤル（171）の使い方を確認',
    ],
  },
  {
    id: 'evacuation',
    title: '避難所での過ごし方',
    icon: <Building size={24} color={Design.colors.primary} />,
    content: [
      '1. 避難所に到着したら',
      '   - 受付で名前を登録',
      '   - 避難スペースを確保',
      '   - ルールを確認',
      '',
      '2. 衛生管理',
      '   - 手洗い・うがいを徹底',
      '   - マスクを着用',
      '   - ゴミは分別して捨てる',
      '',
      '3. 周囲への配慮',
      '   - 大きな声で話さない',
      '   - プライベートスペースを尊重',
      '   - 困っている人を助ける',
      '',
      '4. 情報収集',
      '   - ラジオで最新情報を確認',
      '   - デマに注意',
      '   - 正確な情報源から情報を得る',
    ],
  },
];

export default function DisasterManualScreen() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['earthquake']));

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <ScreenLayout title="行動マニュアル" subtitle="災害時の行動指針" contentStyle={styles.content}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {MANUAL_SECTIONS.map(section => {
          const isExpanded = expandedSections.has(section.id);
          return (
            <View key={section.id} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.id)}
              >
                <View style={styles.sectionHeaderLeft}>
                  {section.icon}
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                {isExpanded ? (
                  <ChevronUp size={20} color={Design.colors.textMuted} />
                ) : (
                  <ChevronDown size={20} color={Design.colors.textMuted} />
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.sectionContent}>
                  {section.content.map((line, index) => (
                    <Text
                      key={index}
                      style={[
                        styles.contentLine,
                        line.trim() === '' && styles.emptyLine,
                        line.match(/^\d+\./) && styles.bulletPoint,
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ※ このマニュアルは一般的な指針です。{'\n'}
            実際の災害時は、自治体の指示に従って行動してください。
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Design.spacing.lg, paddingTop: Design.spacing.lg },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Design.spacing.xxl,
  },
  section: {
    backgroundColor: Design.colors.background,
    borderRadius: Design.radius.lg,
    marginBottom: Design.spacing.md,
    borderWidth: 1,
    borderColor: Design.colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Design.spacing.lg,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Design.spacing.md,
    flex: 1,
  },
  sectionTitle: {
    fontSize: Design.fontSize.body,
    fontWeight: Design.fontWeight.bold,
    color: Design.colors.text,
  },
  sectionContent: {
    paddingHorizontal: Design.spacing.lg,
    paddingBottom: Design.spacing.lg,
  },
  contentLine: {
    fontSize: Design.fontSize.body,
    color: Design.colors.text,
    lineHeight: 26,
    marginBottom: Design.spacing.xs,
  },
  emptyLine: {
    height: Design.spacing.sm,
  },
  bulletPoint: {
    fontWeight: Design.fontWeight.semi,
    color: Design.colors.text,
  },
  footer: {
    marginTop: Design.spacing.xxl,
    padding: Design.spacing.lg,
    backgroundColor: '#fef3c7',
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  footerText: {
    fontSize: Design.fontSize.caption,
    color: '#92400e',
    lineHeight: 20,
  },
});
