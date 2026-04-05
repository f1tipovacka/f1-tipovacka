import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://xaanjdteelgndvlejbhz.supabase.co"
const supabaseKey = "sb_publishable_pXnkWv9Zz4AjgmggoyobMg_h5RbIgNc"

export const supabase = createClient(supabaseUrl, supabaseKey)