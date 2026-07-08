// [AGC:FILE] tool=Cc author=fangkun date=2026-07-08
import { computed, type Ref } from 'vue'

// [AGC:START] tool=Cc author=fangkun
export function useTemplateVariables(
  systemPrompt: Ref<string>,
  userPrompt: Ref<string>,
  systemVariables: Ref<string[]>
) {
  // 提取所有变量
  const allVariables = computed(() => {
    const vars = new Set<string>()
    const pattern = /\{\{(\w+)\}\}/g

    let match
    while ((match = pattern.exec(systemPrompt.value)) !== null) {
      vars.add(match[1])
    }
    while ((match = pattern.exec(userPrompt.value)) !== null) {
      vars.add(match[1])
    }

    return Array.from(vars)
  })

  // 用户需要输入的变量 = 全部变量 - 系统变量
  const userVariables = computed(() => {
    return allVariables.value.filter(v => !systemVariables.value.includes(v))
  })

  // 替换变量
  const replaceVariables = (
    text: string,
    values: Record<string, string>
  ): string => {
    let result = text
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
    return result
  }

  return {
    allVariables,
    userVariables,
    replaceVariables
  }
}
// [AGC:END]