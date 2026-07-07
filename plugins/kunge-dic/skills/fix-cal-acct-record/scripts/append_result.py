# [AGC:FILE] tool=Cc author=fangkun date=2026-06-30
"""
追加分析结果到 Excel 文件
每次调用追加一行，支持增量写入
"""
import os
import sys
import argparse

import openpyxl
from openpyxl import Workbook


# [AGC:START] tool=Cc author=fangkun
def append_result(output_path: str, prod_inst_id: str, acct_item_type_id: str,
                  sql: str, prompt: str):
    """追加一行分析结果到 Excel 文件"""
    if os.path.exists(output_path):
        wb = openpyxl.load_workbook(output_path)
        ws = wb.active
    else:
        wb = Workbook()
        ws = wb.active
        ws.title = "分析结果"
        ws.append(["PROD_INST_ID", "ACCT_ITEM_TYPE_ID", "UPDATE_SQL", "ANALYSIS_PROMPT"])

    ws.append([prod_inst_id, acct_item_type_id, sql, prompt])
    wb.save(output_path)
    print(f"已追加: PROD_INST_ID={prod_inst_id}, ACCT_ITEM_TYPE_ID={acct_item_type_id}")
# [AGC:END]


# [AGC:START] tool=Cc author=fangkun
def main():
    parser = argparse.ArgumentParser(description='追加分析结果到 Excel')
    parser.add_argument('--output', required=True, help='输出 Excel 文件路径')
    parser.add_argument('--prod-inst-id', required=True, help='产品实例ID')
    parser.add_argument('--acct-item-type-id', required=True, help='账目项类型ID')
    parser.add_argument('--sql', required=True, help='生成的修复SQL')
    parser.add_argument('--prompt', required=True, help='分析过程/提示词')
    args = parser.parse_args()

    try:
        append_result(args.output, args.prod_inst_id, args.acct_item_type_id,
                     args.sql, args.prompt)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
# [AGC:END]


if __name__ == '__main__':
    main()
