## ADDED Requirements

### Requirement: Prompt maintenance is accessible from the main navigation menu
The system SHALL display a "提示词维护" menu item in the left navigation sidebar. Selecting it SHALL display the PromptMaintenanceView component in the main content area.

#### Scenario: User clicks the maintenance menu item
- **WHEN** user clicks "提示词维护" in the sidebar
- **THEN** the main content area displays the PromptMaintenanceView component
- **THEN** the menu item is highlighted as active

### Requirement: Maintenance tab is removed from PromptView
The system SHALL NOT display a "维护" tab within the PromptView component. The PromptView tabs SHALL only include: 优化, 迭代, 测试, 模型, 历史, 设置.

#### Scenario: User views PromptView tabs
- **WHEN** user navigates to the prompt optimizer
- **THEN** no "维护" tab is visible among the tabs
- **THEN** all other tabs (优化, 迭代, 测试, 模型, 历史, 设置) remain present
