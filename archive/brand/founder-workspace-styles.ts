import { StyleSheet } from "react-native";

export const workspaceStyles = StyleSheet.create({
  taskCard: { backgroundColor: "#211F1B", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#3B3932", marginBottom: 14 },
  taskHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  taskCount: { color: "#D6E27A", fontSize: 20, fontWeight: "900" },
  workspaceTask: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#3B3932", paddingVertical: 13 },
  taskCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#77746B", alignItems: "center", justifyContent: "center" },
  taskCheckDone: { backgroundColor: "#D6E27A", borderColor: "#D6E27A" },
  taskCheckText: { color: "#161512", fontSize: 13, fontWeight: "900" },
  taskTitle: { color: "#F4F0E6", fontSize: 14, fontWeight: "800" },
  taskDone: { textDecorationLine: "line-through", color: "#A8A59B" },
  taskBody: { color: "#A8A59B", fontSize: 12, lineHeight: 17, marginTop: 2 },
  taskStage: { color: "#A8A59B", fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  settingsToggle: { paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#3B3932", marginBottom: 14 },
  settingsHint: { color: "#A8A59B", fontSize: 12, marginTop: 4 },
  settingsCard: { backgroundColor: "#211F1B", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#3B3932", marginBottom: 14 },
  cloudCard: { backgroundColor: "#181713", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#3B3932", marginBottom: 4 },
  cloudTitle: { color: "#D6E27A", fontSize: 13, fontWeight: "800" },
});
