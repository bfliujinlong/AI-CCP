#!/usr/bin/env python3
"""向本地后端 API 插入初始数据（模拟 database/init.sql）"""
import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:8000/api/v1"


def post(path, data, token=None):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  HTTP {e.code}: {body[:200]}")
        return None


def get(path, token=None):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  HTTP {e.code}: {body[:200]}")
        return None


def main():
    # 1. 登录
    login_data = {"username": "admin", "password": "admin123"}
    with urllib.request.urlopen(
        urllib.request.Request(
            f"{BASE_URL}/auth/login",
            data=json.dumps(login_data).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
    ) as resp:
        result = json.loads(resp.read())
    token = result["access_token"]
    print(f"✓ 登录成功 (admin)")

    # 2. 创建客户
    customers = [
        {"name": "中国银行", "industry": "金融", "contact_name": "张经理", "contact_email": "zhang@boc.com", "contact_phone": "13800138001", "address": "北京市西城区", "description": "国有大型商业银行"},
        {"name": "宝钢集团", "industry": "制造", "contact_name": "李总", "contact_email": "li@baosteel.com", "contact_phone": "13900139002", "address": "上海市宝山区", "description": "大型钢铁制造企业"},
        {"name": "永辉超市", "industry": "零售", "contact_name": "王总监", "contact_email": "wang@yonghui.com", "contact_phone": "13700137003", "address": "福州市台江区", "description": "连锁零售企业"},
        {"name": "字节跳动", "industry": "互联网", "contact_name": "赵架构师", "contact_email": "zhao@bytedance.com", "contact_phone": "13600136004", "address": "北京市海淀区", "description": "互联网科技公司"},
        {"name": "深圳市政府", "industry": "政府", "contact_name": "陈处长", "contact_email": "chen@sz.gov.cn", "contact_phone": "13500135005", "address": "深圳市福田区", "description": "政务云项目"},
        {"name": "浙江大学", "industry": "教育", "contact_name": "刘教授", "contact_email": "liu@zju.edu.cn", "contact_phone": "13400134006", "address": "杭州市西湖区", "description": "高校科研云平台", "is_active": False},
    ]
    print("\n--- 创建客户 ---")
    created_customers = []
    for c in customers:
        r = post("/customers", c, token)
        if r:
            created_customers.append(r)
            print(f"✓ 客户: {r['name']} (ID: {r['id']})")

    # 3. 创建商机
    opportunities = [
        {"name": "中国银行 Landing Zone 项目", "customer_id": created_customers[0]["id"], "type": "landing_zone", "status": "proposal", "estimated_revenue": 2800000, "probability": 70, "description": "为国有银行构建多云 Landing Zone 架构"},
        {"name": "宝钢集团云迁移项目", "customer_id": created_customers[1]["id"], "type": "migration", "status": "negotiation", "estimated_revenue": 3500000, "probability": 60, "description": "核心业务系统从本地机房迁移至华为云"},
        {"name": "永辉超市大数据平台", "customer_id": created_customers[2]["id"], "type": "big_data", "status": "discovery", "estimated_revenue": 1500000, "probability": 40, "description": "构建零售大数据分析平台"},
        {"name": "字节跳动混合云架构", "customer_id": created_customers[3]["id"], "type": "hybrid_cloud", "status": "discovery", "estimated_revenue": 5000000, "probability": 30, "description": "混合云架构设计与实施"},
        {"name": "深圳市政务云安全加固", "customer_id": created_customers[4]["id"], "type": "security", "status": "proposal", "estimated_revenue": 1800000, "probability": 80, "description": "政务云安全合规加固项目"},
        {"name": "中国银行成本优化", "customer_id": created_customers[0]["id"], "type": "cost_optimization", "status": "closed_won", "estimated_revenue": 800000, "probability": 100, "description": "云资源成本优化咨询"},
        {"name": "浙江大学云迁移评估", "customer_id": created_customers[5]["id"], "type": "migration", "status": "closed_lost", "estimated_revenue": 600000, "probability": 0, "description": "科研系统云迁移评估"},
    ]
    print("\n--- 创建商机 ---")
    created_opps = []
    for o in opportunities:
        r = post("/opportunities", o, token)
        if r:
            created_opps.append(r)
            print(f"✓ 商机: {r['name']}")

    # 4. 创建更多 Skill
    skills = [
        {
            "name": "LZ-SOW", "category": "landing_zone",
            "description": "Landing Zone SOW generator - Generate Statement of Work based on Fact Sheet",
            "prompt_template": "Generate a Statement of Work for a Landing Zone project based on the following facts:\n{facts}\nInclude: Project Overview, Scope, Deliverables, Assumptions, Risks, Timeline, and Team Structure.",
            "status": "active",
        },
        {
            "name": "Migration-WBS", "category": "migration",
            "description": "Migration WBS generator - Generate Work Breakdown Structure for cloud migration",
            "prompt_template": "Generate a WBS for cloud migration:\nVM Count: {vm_count}\nDatabase Count: {database_count}\nSource Cloud: {current_cloud}\nTarget Cloud: {target_cloud}",
            "status": "active",
        },
        {
            "name": "Estimate-LZ", "category": "landing_zone",
            "description": "Landing Zone cost estimator - Estimate person-days and cost based on Fact Sheet",
            "prompt_template": "Estimate cost for Landing Zone:\nAccount Count: {account_count}\nRegion Count: {region_count}\nVPC Count: {vpc_count}\nSecurity Level: {security_level}",
            "status": "active",
        },
        {
            "name": "Generate-FactSheet", "category": "general",
            "description": "Fact Sheet generator - Auto-generate structured Fact Sheet from project information",
            "prompt_template": "Generate a structured Fact Sheet:\nProject Type: {project_type}\nCurrent Cloud: {current_cloud}\nTarget Cloud: {target_cloud}",
            "status": "active",
        },
        {
            "name": "Generate-Quotation", "category": "general",
            "description": "AI quotation generator - Auto-generate project quotation from Fact Sheet",
            "prompt_template": "Generate a detailed quotation based on Fact Sheet:\n{facts}",
            "status": "active",
        },
        {
            "name": "Generate-SOW", "category": "general",
            "description": "SOW generator - Auto-generate Statement of Work from Fact Sheet",
            "prompt_template": "Generate a Statement of Work based on project facts:\n{facts}",
            "status": "active",
        },
        {
            "name": "Generate-WBS", "category": "general",
            "description": "WBS generator - Auto-generate Work Breakdown Structure from project facts",
            "prompt_template": "Generate a Work Breakdown Structure based on project facts:\n{facts}",
            "status": "active",
        },
    ]
    print("\n--- 创建 Skills ---")
    for s in skills:
        r = post("/skills", s, token)
        if r:
            print(f"✓ Skill: {r['name']}")

    print("\n--- 验证数据 ---")
    customers_data = get("/customers", token)
    print(f"客户总数: {customers_data['total']}")
    opps_data = get("/opportunities", token)
    print(f"商机总数: {opps_data['total']}")
    skills_data = get("/skills", token)
    print(f"Skill 总数: {len(skills_data.get('items', skills_data) if isinstance(skills_data, dict) else skills_data)}")

    print("\n✅ 初始数据导入完成！")
    print(f"数据库路径: D:/Work/日常/上云迁移/.../backend/aicc.db")
    print(f"默认账号: admin / admin123")


if __name__ == "__main__":
    main()
