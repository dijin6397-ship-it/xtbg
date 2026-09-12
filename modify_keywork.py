import sys
with open('src/views/admin/A_TaskDetail.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# 修改1: 让领导评分编辑区域在任务进行中且有关键工作输出物时就显示
old1 = "<div v-if=\"canApprove && task.status === 'review'\" class=\"final-actions\">"
new1 = "<div v-if=\"canApprove && (task.status === 'review' || task.task_type === 'key_work')\" class=\"final-actions\">"

# 修改2: 添加 canApprove 条件到 key_work 评分区域
old2 = "<div v-if=\"task.task_type === 'key_work' && task.outputs?.length\" class=\"key-work-scores\">"
new2 = "<div v-if=\"canApprove && task.task_type === 'key_work' && task.outputs?.length\" class=\"key-work-scores\">"

if old1 in content:
    content = content.replace(old1, new1)
    print('Modified approval condition')
else:
    print('Pattern 1 not found')

if old2 in content:
    content = content.replace(old2, new2)
    print('Modified key_work score condition')
else:
    print('Pattern 2 not found')

with open('src/views/admin/A_TaskDetail.vue', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
