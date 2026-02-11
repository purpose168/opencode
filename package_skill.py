#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
打包技能脚本
将待办列表管理技能打包成.skill文件
"""

import zipfile
import os
import sys

def package_skill(skill_dir, output_file):
    """
    打包技能
    
    Args:
        skill_dir (str): 技能目录路径
        output_file (str): 输出文件路径
    """
    try:
        with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 遍历技能目录中的所有文件
            for root, dirs, files in os.walk(skill_dir):
                for file in files:
                    # 构建文件路径
                    file_path = os.path.join(root, file)
                    # 计算相对路径，用于zip文件中的存储路径
                    arcname = os.path.relpath(file_path, os.path.dirname(skill_dir))
                    # 添加文件到zip文件
                    zf.write(file_path, arcname)
                    print(f"添加文件: {arcname}")
        
        print(f"\n技能打包成功: {output_file}")
        return True
    except Exception as e:
        print(f"打包失败: {str(e)}")
        return False

if __name__ == '__main__':
    skill_dir = 'todo-manager-skill'
    output_file = 'todo-manager.skill'
    
    if not os.path.exists(skill_dir):
        print(f"错误: 技能目录 '{skill_dir}' 不存在")
        sys.exit(1)
    
    package_skill(skill_dir, output_file)