import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Heart, Star, Sparkles, MapPin, ShieldCheck, MessageCircle, Video, CalendarDays } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Heart,
    color: "from-[#ff416c] to-[#ff4b2b]",
    title: "Smart Matching",
    description: "AI-powered suggestions that actually get your vibe.",
  },
  {
    icon: ShieldCheck,
    color: "from-[#4158D0] to-[#C850C0]",
    title: "Verified Profiles",
    description: "Zero catfishes. 100% authentic connections guaranteed.",
  },
  {
    icon: MessageCircle,
    color: "from-[#0093E9] to-[#80D0C7]",
    title: "Real-time Chat",
    description: "Slide into DMs with photos, voice notes, and more.",
  },
  {
    icon: Video,
    color: "from-[#FAD961] to-[#F76B1C]",
    title: "Video Calls",
    description: "Quick vibe checks face-to-face before meeting IRL.",
  },
  {
    icon: CalendarDays,
    color: "from-[#85FFBD] to-[#FFFB7D]",
    title: "Easy Scheduling",
    description: "Lock in dates without the back-and-forth hassle.",
  },
  {
    icon: MapPin,
    color: "from-[#FA709A] to-[#FEE140]",
    title: "Location-based",
    description: "Find your next crush hanging out just around the corner.",
  },
];

const testimonials = [
  {
    name: "Sarah & Mike",
    image: "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=200&h=200&fit=crop",
    quote: "Matched on Monday, coffee by Wednesday. The vibe was instant!",
  },
  {
    name: "Emily & James",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    quote: "The video call saved us! Connected on such a deep level before meeting up.",
  },
  {
    name: "Alex & Jordan",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    quote: "Honestly the best app. So easy to use and everyone is verified.",
  },
];

export default function Landing() {
  return (
    <Layout>
      {/* SVG for the Stylized Heart Clip Path */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <clipPath id="heart-clip" clipPathUnits="objectBoundingBox">
            <path d="M0.5,1 C0.5,1 0,0.7 0,0.35 C0,0.15 0.15,0 0.35,0 C0.45,0 0.5,0.1 0.5,0.1 C0.5,0.1 0.55,0 0.65,0 C0.85,0 1,0.15 1,0.35 C1,0.7 0.5,1 0.5,1 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Hero Section */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-background">
        {/* Organic Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#ff416c] opacity-20 blur-[100px] blob-shape pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-[#ff4b2b] opacity-20 blur-[100px] blob-shape-2 pointer-events-none" />
        
        <div className="container mx-auto px-4 z-10 relative pb-16 pt-24 text-left">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow-md border border-gray-100 text-foreground text-sm font-bold tracking-wide mb-8">
                <Sparkles className="w-4 h-4 text-[#ff416c]" />
                <span className="text-gradient">Ready for your main character moment?</span>
              </div>
              
              <h1 className="text-6xl md:text-[5.5rem] font-bold text-foreground mb-6 leading-[1.1] tracking-tight">
                Find Your
                <br />
                <span className="text-gradient">Perfect Vibe</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 font-medium max-w-lg leading-relaxed">
                Step into a dating experience that actually gets you. Connect, chat, and date on your own terms.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <Link to="/register">
                  <Button 
                    variant="default" 
                    size="xl" 
                    className="gradient-primary text-white text-xl px-10 py-7 rounded-full shadow-glow hover:scale-105 transition-transform duration-300 font-bold border-0"
                  >
                    Start For Free
                  </Button>
                </Link>
                <div className="flex -space-x-4 items-center">
                  {[...Array(4)].map((_, i) => (
                    <img 
                      key={i}
                      src={`https://images.unsplash.com/photo-${1500000000000 + i * 100000}?w=100&h=100&fit=crop`} 
                      className="w-12 h-12 rounded-full border-4 border-background object-cover" 
                      alt="User" 
                      onError={(e) => {
                        e.currentTarget.src = `https://i.pravatar.cc/100?img=${i + 10}`;
                      }}
                    />
                  ))}
                  <div className="pl-6 text-sm font-bold text-muted-foreground">
                    2M+ Users
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Content - Heart Frame Hero Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <motion.div 
                animate={{ y: [-10, 10, -10], rotate: [-5, 5, -5] }}
                transition={{ duration: 5, repeat: Infinity }}
                className="absolute top-10 -left-10 z-20 bg-white p-4 rounded-3xl shadow-xl transform -rotate-12 border border-gray-100"
              >
                <span className="text-5xl drop-shadow-md">💖</span>
              </motion.div>
              <motion.div 
                animate={{ y: [10, -10, 10], rotate: [5, -5, 5] }}
                transition={{ duration: 6, repeat: Infinity }}
                className="absolute bottom-20 -right-10 z-20 bg-white p-4 rounded-3xl shadow-xl transform rotate-12 border border-gray-100"
              >
                <span className="text-5xl drop-shadow-md">✨</span>
              </motion.div>

              <div className="relative w-full aspect-square max-w-[600px] mx-auto filter drop-shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#ff416c] to-[#ff4b2b] rounded-full blur-2xl opacity-30 transform scale-90"></div>
                <img
                  src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop"
                  alt="Couple having fun"
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-700"
                  style={{ clipPath: "url(#heart-clip)" }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 relative bg-white overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
              Why <span className="text-gradient">Heartly?</span>
            </h2>
            <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
              We built this for the way you actually date. No BS, just good vibes and great connections.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                className="p-8 rounded-[2.5rem] bg-gray-50 border border-gray-100 hover:shadow-card hover:bg-white transition-all duration-300 group"
              >
                <div className="w-20 h-20 mb-6 relative group-hover:scale-110 transition-transform duration-500">
                  <div className={`absolute inset-0 bg-gradient-to-tr ${feature.color} opacity-20 rounded-3xl blur-xl group-hover:opacity-40 transition-opacity`}></div>
                  <div className={`relative w-full h-full bg-gradient-to-tr ${feature.color} rounded-2xl shadow-[0_15px_25px_rgba(0,0,0,0.1),inset_0_4px_10px_rgba(255,255,255,0.5),inset_0_-4px_10px_rgba(0,0,0,0.2)] transform -rotate-3 group-hover:rotate-0 transition-transform duration-300 flex items-center justify-center border-b-[4px] border-r-[4px] border-black/10`}>
                    <feature.icon className="w-10 h-10 text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground font-medium text-lg leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 bg-gray-50 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff4b2b] opacity-10 blur-3xl blob-shape pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
              Main <span className="text-gradient">Characters</span>
            </h2>
            <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
              Don't just take our word for it. Look at these success stories.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-10 rounded-[2.5rem] bg-white shadow-sm hover:shadow-xl transition-shadow border border-gray-100 relative"
              >
                <div className="absolute -top-6 -right-6 text-6xl opacity-20">"</div>
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-24 h-24 rounded-full mb-6 object-cover border-4 border-white shadow-lg mx-auto"
                />
                <div className="flex items-center justify-center gap-1 text-yellow-400 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
                <p className="text-foreground text-xl font-medium mb-8 leading-relaxed text-center">"{testimonial.quote}"</p>
                <p className="text-lg font-bold text-foreground text-center tracking-tight">
                  {testimonial.name}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden bg-white">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto text-center p-16 md:p-24 rounded-[3rem] gradient-primary shadow-glow relative overflow-hidden"
          >
            {/* CTA Background Assets */}
            <div className="absolute top-[-20%] right-[-10%] opacity-30 transform rotate-12">
              <span className="text-9xl drop-shadow-xl">💖</span>
            </div>
            <div className="absolute bottom-[-20%] left-[-10%] opacity-30 transform -rotate-12">
              <span className="text-9xl drop-shadow-xl">✨</span>
            </div>

            <Heart className="w-16 h-16 text-white mx-auto mb-8 animate-bounce fill-current" />
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              Ready to Vibe?
            </h2>
            <p className="text-white/90 text-xl md:text-2xl mb-12 max-w-2xl mx-auto font-medium">
              Join the millions finding real connections today. No games, just dates.
            </p>
            <Link to="/register">
              <Button
                variant="outline"
                size="xl"
                className="bg-white text-[#ff4b2b] hover:bg-gray-50 hover:text-[#ff416c] hover:scale-105 transition-all duration-300 border-0 rounded-full px-12 py-8 text-2xl font-bold shadow-xl"
              >
                Get Started
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-gray-100 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center gradient-primary text-white font-bold text-xl shadow-md transform -rotate-6">
                H
              </div>
              <span className="text-2xl font-bold tracking-tight text-foreground">Heartly</span>
            </div>
            <div className="flex items-center gap-8 text-base font-medium text-muted-foreground">
              <a href="#" className="hover:text-foreground hover:underline decoration-2 underline-offset-4 transition-all">About</a>
              <a href="#" className="hover:text-foreground hover:underline decoration-2 underline-offset-4 transition-all">Safety</a>
              <a href="#" className="hover:text-foreground hover:underline decoration-2 underline-offset-4 transition-all">Privacy</a>
              <a href="#" className="hover:text-foreground hover:underline decoration-2 underline-offset-4 transition-all">Terms</a>
            </div>
            <p className="text-sm font-medium text-gray-400">
              © 2026 Heartly. Big vibes only.
            </p>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
