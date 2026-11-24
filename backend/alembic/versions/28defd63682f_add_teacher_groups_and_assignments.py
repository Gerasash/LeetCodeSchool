"""add_teacher_groups_and_assignments

Revision ID: 28defd63682f
Revises: b57877187fce
Create Date: 2026-11-24 16:49:36.422018

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '28defd63682f'
down_revision: str | Sequence[str] | None = 'b57877187fce'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Добавление колонки error_message в submissions
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('error_message', sa.Text(), nullable=True))

    # 2. Создание таблицы study_groups (если ещё не существует)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'study_groups' not in existing_tables:
        op.create_table(
            'study_groups',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('invite_code', sa.String(length=16), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('invite_code', name='uq_study_groups_invite_code'),
        )
        op.create_index(op.f('ix_study_groups_invite_code'), 'study_groups', ['invite_code'], unique=True)

    if 'group_members' not in existing_tables:
        op.create_table(
            'group_members',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('student_key', sa.String(length=64), nullable=False),
            sa.Column('student_name', sa.String(length=100), nullable=False),
            sa.Column('joined_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.ForeignKeyConstraint(['group_id'], ['study_groups.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('group_id', 'student_key', name='uq_group_student'),
        )
        op.create_index(op.f('ix_group_members_student_key'), 'group_members', ['student_key'], unique=False)

    if 'assignments' not in existing_tables:
        op.create_table(
            'assignments',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('group_id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=200), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.ForeignKeyConstraint(['group_id'], ['study_groups.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'assignment_problems' not in existing_tables:
        op.create_table(
            'assignment_problems',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('assignment_id', sa.Integer(), nullable=False),
            sa.Column('problem_id', sa.Integer(), nullable=False),
            sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
            sa.ForeignKeyConstraint(['assignment_id'], ['assignments.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['problem_id'], ['problems.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('assignment_id', 'problem_id', name='uq_assignment_problem'),
        )


def downgrade() -> None:
    op.drop_table('assignment_problems')
    op.drop_table('assignments')
    op.drop_index(op.f('ix_group_members_student_key'), table_name='group_members')
    op.drop_table('group_members')
    op.drop_index(op.f('ix_study_groups_invite_code'), table_name='study_groups')
    op.drop_table('study_groups')
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.drop_column('error_message')
