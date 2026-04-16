import { InsertRepo } from "../../utils/interfaces"

const db = require("./db")
const table = "repositories"



const get_repo = async (github_repo_id: number) => {
    try {
        const query = db.select("*").from(table).where("github_repo_id", github_repo_id).first()
        return await query
    } catch (error) {
        throw error
    }
}

const insert_repo = async (data: InsertRepo) => {
    try {
        const query = db(table).insert({
            github_repo_id: data.github_repo_id,
            github_account_id: data.github_account_id,
            name: data.name,
            full_name: data.full_name,
            owner_login: data.owner_login,
            default_branch: data.default_branch,
            private: data.private,
            archived: data.archived,
            language: data.language,
            github_created_at: data.github_created_at,
            github_updated_at: data.github_updated_at,
            pushed_at: data.pushed_at
        }).returning("*")

        return await query
    } catch (error) {
        throw error
    }
}
interface UpdateWhereDataRepositories {
    id: number,
    github_repo_id: number
}

const update_repo_github_accounts_id = async (where_data: UpdateWhereDataRepositories, is_active: boolean = true) => {
    try {
        const query = db.raw(`
            update repositories
                set 
                is_active = ${is_active}
            where github_account_id = (
                select id from github_accounts where id = ${where_data.id}
                )
            and github_repo_id = ${where_data.github_repo_id}
            `)

        const result = await query
        return result.rows
    } catch (error) {
        throw error
    }
}


export {
    get_repo,
    insert_repo,
    update_repo_github_accounts_id
}