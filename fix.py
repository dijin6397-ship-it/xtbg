import codecs
path = r"C:\zkf\xtbg-main\src\views\admin\A_TaskDetail.vue"
lines = codecs.open(path, "r", encoding="utf-8").readlines()
new = lines[:81]
new.append("            <div v-if=\"out.scoreRule\" class=\"output-score\">\n")
new.append("              <span class=\"score-label\">分值：</span>\n")
new.append("              <span v-if=\"out.scoreTotal > 0\" class=\"score-text\">{{ out.scoreValue }} x {{ out.scoreQuantity }} = <strong>{{ out.scoreTotal }}</strong></span>\n")
new.append("              <span v-else class=\"score-text score-placeholder\">参考分值 {{ out.refScoreValue }} - {{ out.refScoreUpper }}</span>\n")
new.append("              <span class=\"output-rule\">({{ ruleLabel(out.scoreRule) }})</span>\n")
new.append("              <span v-if=\"out.submitScore\" class=\"self-score-tag\">自评</span>\n")
new.append("            </div>\n")
new.extend(lines[86:])
codecs.open(path, "w", encoding="utf-8").writelines(new)
print("Done")