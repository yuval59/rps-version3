import { GameBoard } from '@/components'

const Home = () => {
    return (
        <div className='flex flex-col flex-1 items-center justify-center gap-6 bg-zinc-50 font-sans dark:bg-black'>
            <GameBoard />
        </div>
    )
}

export default Home
